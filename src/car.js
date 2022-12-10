/* 
 * Car class for handling gamepad, accelerometer, onscreen joystic and keyboard
 */
function mapValue(value, fromA, fromB, toA, toB) {
  if (value === null || value === undefined) {
    return null;
  }
  return toA + (toB - toA) / (fromB - fromA) * (value - fromA);
}

export class Car {
    constructor(joysticZone) {
        // units in percentage range 0..1 
        this.steering = 0.0;
        this.throttle = 0.0;
        this.braking = 0.0;
        this.gear = 0;
        this.max_steering = 1.0;
        this.max_acceleration = 1.0;
        this.max_braking = 1.0;
        this.braking_k = 5.0;            // coeficient used for virtual speed braking calc 
        this.min_deacceleration = 5;     // speed reduction when nothing is pressed
        // units of change over one second:
        this.steering_speed = 5.0; 
        this.steering_speed_neutral = 3.0;
        this.acceleration_speed = 5.0;
        this.deacceleration_speed = 2.0;
        this.braking_speed = 5.0;
        // virtual speed
        this.virtual_speed = 0.0;
        this.max_virtual_speed =  5.0;
        // key states
        this.left_down = false;
        this.right_down = false;
        this.up_down = false;
        this.down_down = false;
        window.addEventListener('keydown', this.keyDown.bind(this));
        window.addEventListener('keyup', event => this.keyUp(event));
        this.cbAccelerometer = document.getElementById("cb-accelerometer");

        this.vrGamepads = [];
        this.gamepad;        
        this.gamepadSteering = 0.0;
        this.gamepadThrottle = 0.0;
        this.gamepadBraking = 0.0;
        this.gamepadGearUpKey_down = false;
        this.gamepadGearDownKey_down = false;
        window.addEventListener('gamepadconnected', this.gamepadConnected.bind(this));      
        window.addEventListener('gamepaddisconnected', this.gamepadDisconnected.bind(this));      
        this.enumerateGamepads();
      
        this.accelerometerSteering = null;
        let accelerometer = null;
        try {
            accelerometer = new Accelerometer({ referenceFrame: 'device', frequency: 60});
            accelerometer.addEventListener('error', event => {
                // Handle runtime errors.
                if (event.error.name === 'NotAllowedError') {
                    // Branch to code for requesting permission.
                } else if (event.error.name === 'NotReadableError' ) {
                    console.log('Cannot connect to the sensor.');
                }
            });
            accelerometer.addEventListener('reading', () => {
                this.accelerometerSteering = Math.min(1.0, Math.max(-1.0, accelerometer.y / 5.0));
            });
            accelerometer.start();
        } catch (error) {
            // Handle construction errors.
            if (error.name === 'SecurityError') {
                // See the note above about feature policy.
                console.log('Sensor construction was blocked by a feature policy.');
            } else if (error.name === 'ReferenceError') {
                console.log('Sensor is not supported by the User Agent.');
            } else {
                throw error;
            }
        }
        
        let options = {
            //zone: document.getElementById('remote-video'),
            zone: joysticZone,
            color: 'blue',
            multitouch: false,
            /*
            color: String,
            size: Integer,
            threshold: Float,               // before triggering a directional event
            fadeTime: Integer,              // transition time
            multitouch: Boolean,
            maxNumberOfNipples: Number,     // when multitouch, what is too many?
            dataOnly: Boolean,              // no dom element whatsoever
            position: Object,               // preset position for 'static' mode
            mode: String,                   // 'dynamic', 'static' or 'semi'
            restJoystick: Boolean,
            restOpacity: Number,            // opacity when not 'dynamic' and rested
            lockX: Boolean,                 // only move on the X axis
            lockY: Boolean,                 // only move on the Y axis
            catchDistance: Number           // distance to recycle previous joystick in 'semi' mode
            */
          };
          this.joystick = null;
          this.joystickData = null;
          this.joystickManager = nipplejs.create(options);
          this.joystickManager.on('start', (evt, nibble) => {
            this.joystick = nibble;
          }).on('end', (evt, nibble) => {
            if (this.joystick === nibble) {
                this.joystick = null;
                this.joystickData = null;
            };
          }).on('move', (evt, data) => {
            console.log(`Joystick ${JSON.stringify(data)}`);
            if (this.joystick === data.instance) {
                this.joystickData = data;
            };
          });        
    }

    
    dispose () {
        window.removeEventListener('keydown', this.keyDown);
        window.removeEventListener('keyup', this.keyUp);
        window.removeEventListener('gamepadconnected', this.gamepadConnected);
        window.removeEventListener('gamepaddisconnected', this.gamepadDisconnected);
    }

    // Update car control calculation. Input preference in priority order: 
    // Gamepad, accelerator, onscreen joystic, keyboard
    // Param dt_ms in ms
    update(dt_ms) {
        let dt = dt_ms / 1000.0;
        this.updateGamepad();
        
        // calculate steering
        if (this.gamepad) {
          this.steering = this.gamepadSteering;
        } else if (this.cbAccelerometer.checked && this.accelerometerSteering !== null) {
            this.steering = this.accelerometerSteering;
        }
        else if (this.joystickData) {
            let dx = this.joystickData.force * Math.cos(this.joystickData.angle.radian); 
            // this.joystickData.instance.options.size;
            this.steering = Math.min(1.0, Math.max(-1.0, dx));
        } else if (!this.left_down && !this.right_down) {
            // free center positioning
            if (this.steering > 0) {
                this.steering = Math.max(0.0, this.steering - dt * this.steering_speed_neutral);
            } else {
                this.steering = Math.min(0.0, this.steering + dt * this.steering_speed_neutral);
            }
        } else if (this.left_down && !this.right_down) {
            this.steering = Math.max(-1.0, this.steering - dt * this.steering_speed)
        } else if (!this.left_down && this.right_down) {
            this.steering = Math.min(1.0, this.steering + dt * this.steering_speed)
        }

        // calculating gear, throttle, braking
        if (this.gamepad) {
          this.throttle = this.gamepadThrottle;
          this.braking = this.gamepadBraking;
          // gear is updated directly in updateGamepad()
        } else if (this.joystickData) {
            let dy = this.joystickData.force * Math.sin(this.joystickData.angle.radian) / 1.5;
            dy = Math.min(1.0, Math.max(-1.0, dy));
            if (this.gear == 0 && Math.abs(dy) > 0.15) {  
                this.gear = dy > 0 ? 1 : -1;
            }
            if (this.gear == 1) {     // forward
                if (dy > 0) {
                    this.throttle = dy;
                    this.braking = 0.0;
                } else {
                    this.throttle = 0.0;
                    this.braking = -dy;
                }
            } else if (this.gear == -1) {  // reverse
                if (dy < 0) {
                    this.throttle = -dy;
                    this.braking = 0.0;
                } else {
                    this.throttle = 0.0;
                    this.braking = dy;
                }
            }
        } else if (this.up_down && !this.down_down) {
            if (this.gear == 0) {  
                this.gear = 1;
                this.throttle = 0.0;
            }
            if (this.gear == 1) {     // drive accelerating
                this.throttle = Math.min(this.max_acceleration, this.throttle + dt * this.acceleration_speed);
                this.braking = 0.0;
            } else if (this.gear == -1) {  // reverse braking
                this.braking = Math.min(this.max_braking, this.braking + dt * this.braking_speed);
                this.throttle = 0.0;
            }
        } else if (!this.up_down && this.down_down) {
            if (this.gear == 0) {
                this.gear = -1;
                this.throttle = 0.0;
            }
            if (this.gear == 1) {     // drive braking
                this.braking = Math.min(this.max_braking, this.braking + dt * this.braking_speed);
                this.throttle = 0.0;
            } else if (this.gear == -1) {  // reverse accelerating
                this.throttle = Math.min(this.max_acceleration, this.throttle + dt * this.acceleration_speed);
                this.braking = 0.0;
            }
        } else {  // both down or both up
            this.throttle = Math.max(0.0, this.throttle - dt * this.deacceleration_speed);
            this.braking = Math.max(0.0, this.braking - dt * this.deacceleration_speed);
        }

        // calculate virtual speed
        if (this.up_down == this.down_down) {
            // nothing or both pressed
            this.virtual_speed = Math.max(0.0, Math.min(this.max_virtual_speed, 
                this.virtual_speed - dt * this.min_deacceleration));
        } else {
            this.virtual_speed = Math.max(0.0, Math.min(this.max_virtual_speed, 
                this.virtual_speed + dt * (this.throttle - this.braking_k * this.braking)));
        }
        
        // conditions to change the direction for keyboard driving only
        if (!this.up_down && !this.down_down && !this.joystickData && !this.gamepad && this.virtual_speed < 0.01) {
            this.gear = 0;
        }
    }

    handle_key_event(event) {
        const keydown = event.type === "keydown";
        if (keydown || event.type === "keyup") {
            if (event.code === "ArrowLeft") { 
                this.left_down = keydown;
            } else if (event.code == "ArrowRight") {
                this.right_down = keydown;
            } else if (event.code === "ArrowUp") {
                this.up_down = keydown;
            } else if (event.code === "ArrowDown") {
                this.down_down = keydown;
            }
        }
    }
    
    keyDown(event) {
        // console.log('keydown', event.code);
        this.handle_key_event(event);
    }
      
    keyUp(event) {
        // console.log('keyup', event.code);
        this.handle_key_event(event);
    }      

    gamepadConnected(event) {
      console.log('Gamepad connected ' + event.toString());
      this.enumerateGamepads();
      if (this.gamepad != null) {
        console.log('Gamepad connected ' + (this.gamepad.id ?? ''));
      }
    }
  
    gamepadDisconnected(event) {
      if (this.gamepad != null) {
        console.log('Gamepad disconnected');
      }
      this.enumerateGamepads();
    }

    enumerateGamepads() {
      // From https://github.com/toji/webvr.info/blob/master/samples/XX-vr-controllers.html
      // Loop over every gamepad and if we find any that have a pose use it.
      var gamepads = navigator.getGamepads();
      this.gamepad = null;
      for (var i = 0; i < gamepads.length; ++i) {    
        var gp = gamepads[i];
        // The array may contain undefined gamepads, so check for that as
        // well as a non-null pose. VR clicker devices such as the Carboard
        // touch handler for Daydream have a displayId but no pose.
        if (gp) {
          if (!this.gamepad) {
            // use the first gamepad for driving
            this.gamepad = gp;
          }
          if (gp.pose || gp.displayId)
            vrGamepads.push(gp);
          if ("hapticActuators" in gp && gp.hapticActuators.length > 0) {
            for (var j = 0; j < gp.buttons.length; ++j) {
              if (gp.buttons[j].pressed) {
                // Vibrate the gamepad using to the value of the button as
                // the vibration intensity.
                gp.hapticActuators[0].pulse(gp.buttons[j].value, 100);
                break;
              }
            }
          }
          if ("vibrationActuator" in gp && gp.vibrationActuator) {
            //? gp.vibrationActuator.pulse(1.0, 200);
            gp.vibrationActuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: 200,
              weakMagnitude: 1.0,
              strongMagnitude: 1.0,
            });
          }
        }
      }
    }
    
    updateGamepad() {
      var gamepads = navigator.getGamepads()
      this.gamepad = gamepads.length > 0 ? gamepads[0] : null;
      if (!this.gamepad) {
        return;
      }
      if (this.gamepad.id === "B66E" || // Windows: Thrustmaster T300
          this.gamepad.id === "B66E (Vendor: 044f Product: b66e)") { // Windows: Thrustmaster T300
        this.gamepadSteering = this.gamepad.axes[0] || 0.0;
        this.gamepadThrottle =  mapValue(this.gamepad.axes[5], 1.0, -1.0, 0.0, 1.0) || 0.0;
        this.gamepadBraking = mapValue(this.gamepad.axes[1], 1.0, -1.0, 0.0, 1.0) || 0.0;

        const upButton = this.gamepad.buttons[1];
        if (upButton) {
          if (upButton.pressed && !this.gamepadGearUpKey_down && this.gear < 1) {
            this.gear++;
          }
          this.gamepadGearUpKey_down = upButton.pressed;
        }

        const downButton = this.gamepad.buttons[0];
        if (downButton) {
          if (downButton.pressed && !this.gamepadGearDownKey_down && this.gear > -1) {
            this.gear--;
          }
          this.gamepadGearDownKey_down = downButton.pressed;
        }
      }
      else if (this.gamepad.id === "Logitech Formula Force RX" || // Windows: Logitech Formula Force RX
          this.gamepad.id === "G29 Driving Force Racing Wheel (Vendor: 046d Product: c24f)" || // Windows: Logitech G29
          this.gamepad.id === "Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c294)" || // Ubuntu: Logitech G29
          this.gamepad.id === "Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c24f)" || // Ubuntu: Logitech G29
          false) {
        this.gamepadSteering = this.gamepad.axes[0] || 0.0;
        this.gamepadThrottle =  mapValue(this.gamepad.axes[2], 1.0, -1.0, 0.0, 1.0) || 0.0;
        if (this.gamepad.id === "Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c294)" ||
            this.gamepad.id === "Logitech G29 Driving Force Racing Wheel (Vendor: 046d Product: c24f)" ||
            false) {
          // for some reason in Linux brake pedal has different axis for the same wheel
          this.gamepadBraking = mapValue(this.gamepad.axes[3], 1.0, -1.0, 0.0, 1.0) || 0.0;
        } else {
          this.gamepadBraking = mapValue(this.gamepad.axes[5], 1.0, -1.0, 0.0, 1.0) || 0.0;
        }

        const upButton = this.gamepad.buttons[4];
        if (upButton) {
          if (upButton.pressed && !this.gamepadGearUpKey_down && this.gear < 1) {
            this.gear++;
          }
          this.gamepadGearUpKey_down = upButton.pressed;
        }

        const downButton = this.gamepad.buttons[5];
        if (downButton) {
          if (downButton.pressed && !this.gamepadGearDownKey_down && this.gear > -1) {
            this.gear--;
          }
          this.gamepadGearDownKey_down = downButton.pressed;
        }
      }
      else if (this.gamepad.id === "Xbox 360 Controller (XInput STANDARD GAMEPAD)" ||  // XBox gamepad in Windows
          this.gamepad.id === "Microsoft Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)") { // XBox gamepad in Linux
        // this is default mapping
        this.gamepadSteering = this.gamepad.axes[0] || 0.0;
        this.gamepadThrottle = this.gamepad.buttons[7] ? this.gamepad.buttons[7].value : 0.0;
        this.gamepadBraking = this.gamepad.buttons[6] ? this.gamepad.buttons[6].value : 0.0;

        const upButton = this.gamepad.buttons[5];
        if (upButton) {
          if (upButton.pressed && !this.gamepadGearUpKey_down && this.gear < 1) {
            this.gear++;
          }
          this.gamepadGearUpKey_down = upButton.pressed;
        }

        const downButton = this.gamepad.buttons[4];
        if (downButton) {
          if (downButton.pressed && !this.gamepadGearDownKey_down && this.gear > -1) {
            this.gear--;
          }
          this.gamepadGearDownKey_down = downButton.pressed;
        }
      }
    }

}