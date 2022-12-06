/* 
 * UI based on example from https://github.com/firebase/firebaseui-web
 */

import { Car } from "./car.js";
import "./proto/js/pbrcscarmessages.lib.js";

function getUiConfig() {
  return {
    'callbacks': {
      // Called when the user has been successfully signed in.
      'signInSuccessWithAuthResult': function(authResult, redirectUrl) {
        if (authResult.user) {
          handleSignedInUser(authResult.user);
        }
        if (authResult.additionalUserInfo) {
          document.getElementById('is-new-user').textContent =
              authResult.additionalUserInfo.isNewUser ?
              'New User' : 'Existing User';
        }
        // Do not redirect.
        return false;
      }
    },
    // Opens IDP Providers sign-in flow in a popup.
    'signInFlow': 'popup',
    'signInOptions': [
      // TODO(developer): Remove the providers you don't need for your app.      
      {
        provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        // Required to enable this provider in One-Tap Sign-up.
        authMethod: 'https://accounts.google.com',
        // Required to enable ID token credentials for this provider.
        clientId: CLIENT_ID
      },
      /*
      {
        provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
        scopes :[
          'public_profile',
          'email',
          'user_likes',
          'user_friends'
        ]
      },
      */
      //firebase.auth.TwitterAuthProvider.PROVIDER_ID,
      //firebase.auth.GithubAuthProvider.PROVIDER_ID,
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        // Whether the display name should be displayed in Sign Up page.
        requireDisplayName: true,
        signInMethod: getEmailSignInMethod()
      },
      /*{
        provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        recaptchaParameters: {
          size: getRecaptchaMode()
        }
      },
      */
      //firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
    ],
    // Terms of service url.
    'tosUrl': 'https://www.google.com',
    // Privacy policy url.
    'privacyPolicyUrl': 'https://www.google.com',
    'credentialHelper': firebaseui.auth.CredentialHelper.NONE
  };
}

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());
// Disable auto-sign in.
ui.disableAutoSignIn();


/**
 * @return {string} The URL of the FirebaseUI standalone widget.
 */
function getWidgetUrl() {
  return '/widget#recaptcha=' + getRecaptchaMode() + '&emailSignInMethod=' +
      getEmailSignInMethod();
}


/**
 * Redirects to the FirebaseUI widget.
 */
var signInWithRedirect = function() {
  window.location.assign(getWidgetUrl());
};


/**
 * Open a popup with the FirebaseUI widget.
 */
var signInWithPopup = function() {
  window.open(getWidgetUrl(), 'Sign In', 'width=985,height=735');
};


/**
 * Displays the UI for a signed in user.
 * @param {!firebase.User} user
 */
var handleSignedInUser = function(user) {
  document.getElementById('user-signed-in').style.display = 'block';
  document.getElementById('user-signed-out').style.display = 'none';
  document.getElementById('name').textContent = user.displayName;
  //document.getElementById('email').textContent = user.email;
  //document.getElementById('phone').textContent = user.phoneNumber;
  if (user.photoURL){
    var photoURL = user.photoURL;
    // Append size to the photo URL for Google hosted images to avoid requesting
    // the image with its original resolution (using more bandwidth than needed)
    // when it is going to be presented in smaller size.
    if ((photoURL.indexOf('googleusercontent.com') != -1) ||
        (photoURL.indexOf('ggpht.com') != -1)) {
      photoURL = photoURL + '?sz=' +
          document.getElementById('photo').clientHeight;
    }
    document.getElementById('photo').src = photoURL;
    document.getElementById('photo').style.display = 'block';
  } else {
    document.getElementById('photo').style.display = 'none';
  }
};


/**
 * Displays the UI for a signed out user.
 */
var handleSignedOutUser = function() {
  document.getElementById('user-signed-in').style.display = 'none';
  document.getElementById('user-signed-out').style.display = 'block';
  ui.start('#firebaseui-container', getUiConfig());
};

// Listen to change in auth state so it displays the correct UI for when
// the user is signed in or not.
firebase.auth().onAuthStateChanged(function(user) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('loaded').style.display = 'block';
  user ? handleSignedInUser(user) : handleSignedOutUser();
});

/**
 * Deletes the user's account.
 */
var deleteAccount = function() {
  firebase.auth().currentUser.delete().catch(function(error) {
    if (error.code == 'auth/requires-recent-login') {
      // The user's credential is too old. She needs to sign in again.
      firebase.auth().signOut().then(function() {
        // The timeout allows the message to be displayed after the UI has
        // changed to the signed out state.
        setTimeout(function() {
          alert('Please sign in again to delete your account.');
        }, 1);
      });
    }
  });
};

function postJson(url = ``, data = {}) {
  // Default options are marked with *
  return firebase.auth().currentUser.getIdToken().then((idToken) => {
    return fetch(url, {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        //mode: "no-cors", // no-cors, cors, *same-origin
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        credentials: "include", // include, *same-origin, omit
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          // "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Bearer " + idToken,
        },
        //redirect: "follow", // manual, *follow, error
        //referrer: "no-referrer", // no-referrer, *client
        body: JSON.stringify(data), // body data type must match "Content-Type" header
    })
    .then(response => response.json()); // parses JSON response into native Javascript objects 
  });
}

let rsPostUrl;
let html5VideoElement;
let carIdElement;
let controlElement;
let responseElement;
let controlGamepadElement;
let queueButton;
let closeConnectionButton;
let webrtcPeerConnection;
let webrtcConfiguration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
let queueUpdateTimer = 0;
let controlDataChannel;
let telemetryDataChannel;
let localStream;
let isOfferer = false;
let sendVideo = false;
let sendAudio = false;
let rsPostPromise = Promise.resolve();
let car;
//let remoteTrack = "test";
let remoteTrack = "eeden";
let carId = "eeden_i8_02";

let reportError = function (errmsg) { 
  console.error(errmsg); 
}

function getUserMediaPromise() {
  if (sendVideo || sendAudio) {
      return navigator.mediaDevices.getUserMedia({ video: sendVideo, audio: sendAudio }).then((stream) => {
        console.log('Received local stream');
        localStream = stream;
        webrtcPeerConnection.addStream(stream);
      });
  } else {
      return Promise.resolve();
  }
}

function onIncomingSDP(sdp) {
  console.log("Incoming SDP: " + JSON.stringify(sdp));
  // sdp.sdp = sdp.sdp.replace("video0", "0").replace("application1", "1");
  webrtcPeerConnection.setRemoteDescription(sdp).catch(reportError);
  if (!isOfferer) {
      getUserMediaPromise().then(() => {
        return webrtcPeerConnection.createAnswer({
          offerToReceiveAudio: 1,
          offerToReceiveVideo: 1,
          iceRestart: false,
          voiceActivityDetection: false
        });
      }).then((desc) => {
        console.log("Local description: " + JSON.stringify(desc));
        return webrtcPeerConnection.setLocalDescription(desc);
      }).then(() => {
        let sdp = JSON.parse(JSON.stringify(webrtcPeerConnection.localDescription))
        console.log("Send Local description: " + JSON.stringify(sdp));
        rsPostPromise = rsPostPromise.then(() => postJson(rsPostUrl, sdp));
      }).catch(reportError);
  }
}

function onIncomingICE(ice) {
  if (ice.type === "candidates") {
    ice.candidates.forEach(iceCandidate => onIncomingICE(iceCandidate))
  } else {
    console.log("Incoming ICE: " + JSON.stringify(ice));
    var candidate = new RTCIceCandidate(ice);
    webrtcPeerConnection.addIceCandidate(candidate).catch(reportError);
  }
}

function onAddRemoteStream(event) {
  html5VideoElement.srcObject = event.stream;
  html5VideoElement.onloadedmetadata = (event) => {
      try {
          html5VideoElement.play();
      } catch (e) {
          console.log("Error: " + JSON.stringify(e));
      }                
  };
  html5VideoElement.onclick = (event) => {
      html5VideoElement.play();
  }
}

function onIceCandidate(event) {
  if (event.candidate == null) {
    return;
  }
  let candidate = Object.assign({type: "candidate"}, JSON.parse(JSON.stringify(event.candidate)));
  console.log("Sending ICE candidate out: " + JSON.stringify(candidate));
  rsPostPromise = rsPostPromise.then(() => postJson(rsPostUrl, candidate));
}

function onDataChannel(event) {
  console.log(`telemetryDataChannel ${event.channel.label} created: ${JSON.stringify(event.channel)}`);
  telemetryDataChannel = event.channel;
  telemetryDataChannel.onmessage = handleTelmetryMessage;
  telemetryDataChannel.onopen = handleTelemetryChannelOpen;
  telemetryDataChannel.onclose = handleTelemetryChannelClose;
  // controlDataChannel = telemetryDataChannel;
}

function handleTelmetryMessage(event) {
  let recvTime = (new Date()).getTime();
  if (event.data instanceof ArrayBuffer) {
    let carResponse = proto.rcsCar.CarResponse.deserializeBinary(event.data);
    let carResponseObject = carResponse.toObject();

    let response = {
      "Speed": (3.6 * carResponseObject.speed).toFixed(1),
      "Steering": carResponseObject.steering.toFixed(3),
      "DebugResp": carResponseObject.debugrespstr,
    }
    let s = JSON.stringify(response);
    responseElement.textContent = s;

    /*
    if (carResponseObject.messagetime && carResponseObject.lastrecvmessagetime) {
      console.log(`Telemetry message ${recvTime - carResponseObject.lastrecvmessagetime} ${recvTime - data.messagetime}: \n` +
        `Speed: ${carResponseObject.speed}\n` + 
        `Steering: ${carResponseObject.steering}\n` + 
        `DebugStr: ${carResponseObject.debugrespstr}`);
    } else {
      console.log(`Telemetry message: ${carResponseObject.cartimestamp} - ${carResponseObject.debugrespstr}`);
    } 
    */ 
  } else {
    let data = JSON.parse(event.data);
    if (data.c && data.c2) {
      console.log(`Telemetry message ${recvTime - data.c} ${data.c2 - data.c}: + ${event.data}`);
    } else {
      console.log("Telemetry message: " + event.data);
    }  
  }

  /*var el = document.createElement("p");
  var txtNode = document.createTextNode(event.data);
  
  el.appendChild(txtNode);
  receiveBox.appendChild(el);
  */
}

function handleTelemetryChannelOpen(event) {
  if (telemetryDataChannel) {
    console.log("Telemetry channel open, status has changed to " +
      telemetryDataChannel.readyState);
  }
}

function handleTelemetryChannelClose(event) {
  if (telemetryDataChannel) {
    console.log("Telemetry channel close, status has changed to " +
      telemetryDataChannel.readyState);
  }
}

/**
 * Adds user to queue
 */
var addToQueue = function() {
  carId = carIdElement.value;
  localStorage.carId = carId;
  controlInterval = setInterval(() => updateCar(), 20);
  queueButton.disabled = true;
  closeConnectionButton.disabled = false;
  let q = `https://api.rcsnail.com/v1/queue`;
  isOfferer = true;
  postJson(q, {sid: "dev", car: carId})
  .then(data => {
    console.log(JSON.stringify(data)); // JSON-string from `response.json()` call
    if (data.queueUrl) {
      // listen queue
      let url = data.queueUrl.substring(0, data.queueUrl.lastIndexOf("."));
      let queueRef = firebase.database().refFromURL(url);
      clearTimeout(queueUpdateTimer);
      let startQueueUpdateTimer = () => {
        queueUpdateTimer = setTimeout(() => {
          updateAlive();
        }, data.queueKeepAliveTime ?  data.queueKeepAliveTime * 1000 : 60000);
      }
      let updateAlive = () => {
        clearTimeout(queueUpdateTimer);
        postJson(data.queueUpdateUrl, {}).then(result => {
          // start the timer again if the result was OK
          startQueueUpdateTimer();
        });
      }
      startQueueUpdateTimer();
      
      queueRef.on('value', (dataSnapshot) => {
        let queueItem = dataSnapshot.val();
        console.log('Queue event ' + JSON.stringify(queueItem));
        if (queueItem && queueItem.rsUrl) {
          clearTimeout(queueUpdateTimer);
          rsPostUrl = queueItem.rsPostUrl;
          let rsUrl = queueItem.rsUrl.substring(0, queueItem.rsUrl.lastIndexOf("."));
          isOfferer = !queueItem.createAnswer;
          firebase.database().refFromURL(rsUrl).on('child_added', (dataSnapshot) => {
            // monitoring remote session url
            let rsItem = dataSnapshot.val();
            console.log('RS event ' + JSON.stringify(rsItem));
            if (!rsItem) {
              return;
            }

            ///Object.keys(rsItemList).forEach(function(key) {
            ///  let rsItem = rsItemList[key];
            ///  console.log(key, rsItem);
              switch (rsItem.type) {
                case "answer":
                case "offer":
                case "sdp":
                    onIncomingSDP(rsItem);
                    break;
                case "candidate":
                case "candidates":
                    onIncomingICE(rsItem);
                    break;
                default:
                    break;
              }
            ///});
          });      

          if (!webrtcPeerConnection) {
            webrtcPeerConnection = new RTCPeerConnection(webrtcConfiguration);
            webrtcPeerConnection.onaddstream = onAddRemoteStream;
            webrtcPeerConnection.onicecandidate = onIceCandidate;
            webrtcPeerConnection.ondatachannel = onDataChannel;

            controlDataChannel = webrtcPeerConnection.createDataChannel('control', {
              ordered: false,
              maxRetransmits: 0,                
            });
            // controlDataChannel.binaryType = 'arraybuffer';
            controlDataChannel.onopen = (event) => {
              console.log("controlDataChannel opened: " + JSON.stringify(event));
              //! connect controller to send commands to car
            };
            controlDataChannel.onmessage = (event) => {
              console.log("controlDataChannel message: " + event.data);
            };

            if (isOfferer) {
              getUserMediaPromise().then(() => {
                return webrtcPeerConnection.createOffer({
                  offerToReceiveAudio: 1,
                  offerToReceiveVideo: 1,
                  iceRestart: false,
                  voiceActivityDetection: false
                });
              }).then((desc) => {
                console.log("Local description: " + JSON.stringify(desc));
                return webrtcPeerConnection.setLocalDescription(desc);
              }).then(() => {
                let sdp = JSON.parse(JSON.stringify(webrtcPeerConnection.localDescription))
                console.log("Send Local description: " + JSON.stringify(sdp));
                rsPostPromise = rsPostPromise.then(() => postJson(rsPostUrl, sdp));
              }).catch(reportError);
            }                
          }
        }
      });
    }
  })
  .catch(error => console.error(error));
};

function closeConnection() {
  closeConnectionButton.disabled = true;
  clearInterval(controlInterval);
  if (webrtcPeerConnection) {
    webrtcPeerConnection.close();
    webrtcPeerConnection = null;
  }

  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(videoTrack => {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
    });
  }
    
  queueButton.disabled = false;
}

/**
 * Handles when the user changes the reCAPTCHA or email signInMethod config.
 */
function handleConfigChange() {
  var newRecaptchaValue = document.querySelector(
      'input[name="recaptcha"]:checked').value;
  var newEmailSignInMethodValue = document.querySelector(
      'input[name="emailSignInMethod"]:checked').value;
  location.replace(
      location.pathname + '#recaptcha=' + newRecaptchaValue +
      '&emailSignInMethod=' + newEmailSignInMethodValue);

  // Reset the inline widget so the config changes are reflected.
  ui.reset();
  ui.start('#firebaseui-container', getUiConfig());
}

let controlInterval;
let controlPacketNo = 0;
function updateCar() {
  // send control data
  car.update(20);
  let sendTime = (new Date()).getTime();
  controlPacketNo++;

  let carMessage = new proto.rcsCar.CarCommand();
  carMessage.setPacketno(controlPacketNo);
  carMessage.setMessagetime(sendTime);
  carMessage.setGear(car.gear);
  carMessage.setSteering(car.steering);
  carMessage.setThrottle(car.throttle);
  carMessage.setBraking(car.braking);

  // Serializes to a UInt8Array.
  var bytes = carMessage.serializeBinary();
  if (controlDataChannel && controlDataChannel.readyState === "open") {
    controlDataChannel.send(bytes);
  }

  let data = {
    "p": controlPacketNo,
    // "c": sendTime,
    "g": car.gear,
    "s": car.steering.toFixed(3),
    "t": car.throttle.toFixed(2),
    "b": car.braking.toFixed(2),
  }
  let s = JSON.stringify(data);
  controlElement.textContent = s;

  if (car.vrGamepads.length > 0) {
    s = car.vrGamepads[0].id + " " + JSON.stringify(car.vrGamepads[0]) + " " + JSON.stringify(car.vrGamepads[0].pose);
  } else if (car.gamepad) {
    s = car.gamepad.id + " - " + JSON.stringify(car.gamepad);
  } else {
    s = "No gamepad connected";
  }
  controlGamepadElement.textContent = s;
}

/**
 * Initializes the app.
 */
var initApp = function() {
  let joystickZoneElement = document.getElementById('joystick-zone');
  car = new Car(joystickZoneElement);
  html5VideoElement = document.getElementById('remote-video');
  carIdElement = document.getElementById('car-id');
  if (!!localStorage.carId) {
    carIdElement.value = localStorage.carId;
  }
  controlElement = document.getElementById('control');
  responseElement = document.getElementById('response');
  document.getElementById('btn-fullscreen').addEventListener('click', function() {
    //html5VideoElement.
    joystickZoneElement.requestFullscreen().catch(err => {
      alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
    screen.orientation.lock("landscape");
  });
  

/*
  document.getElementById('sign-in-with-redirect').addEventListener(
      'click', signInWithRedirect);
  document.getElementById('sign-in-with-popup').addEventListener(
      'click', signInWithPopup);
*/
  document.getElementById('sign-out').addEventListener('click', function() {
    firebase.auth().signOut();
  });
  queueButton = document.getElementById('add-to-queue');
  queueButton.addEventListener('click', addToQueue);
  
  closeConnectionButton = document.getElementById('close-connection');
  closeConnectionButton.addEventListener('click', closeConnection);
  closeConnectionButton.disabled = true;

  controlGamepadElement = document.getElementById('control-gamepad');

/*
  document.getElementById('delete-account').addEventListener(
      'click', function() {
        deleteAccount();
      });
*/
/*      
  document.getElementById('recaptcha-normal').addEventListener(
      'change', handleConfigChange);
  document.getElementById('recaptcha-invisible').addEventListener(
      'change', handleConfigChange);
  // Check the selected reCAPTCHA mode.
  document.querySelector(
      'input[name="recaptcha"][value="' + getRecaptchaMode() + '"]')
      .checked = true;
*/

/*
  document.getElementById('email-signInMethod-password').addEventListener(
      'change', handleConfigChange);
  document.getElementById('email-signInMethod-emailLink').addEventListener(
      'change', handleConfigChange);

  // Check the selected email signInMethod mode.
  document.querySelector(
      'input[name="emailSignInMethod"][value="' + getEmailSignInMethod() + '"]')
      .checked = true;
*/ 
};

window.addEventListener('load', initApp);
