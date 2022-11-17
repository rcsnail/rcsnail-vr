# Build proto files
cd src
protoc -I. --js_out="library=pbrcscarmessages.lib,binary:proto/js" proto/pbRcsCarMessages.proto


# For testing install nodejs and then:
npm install http-server -g

# Start webserver:
cd src
http-server

# Open in Chrome:
http://localhost:8080
