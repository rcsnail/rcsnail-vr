# Checkout the code
git clone -b html https://github.com/rcsnail/rcsnail-vr.git

# For local testing install nodejs 12 or newer. 
Ubuntu 18.04 comes with older version and best is to use nvm from https://github.com/nvm-sh/nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash

# Install nodejs:
nvm install 16

# Install http-server:
npm install http-server -g

# Start webserver:
cd src
http-server

# Open in Chrome:
http://localhost:8080

# Development. Build proto files example:
cd src
protoc -I. --js_out="library=pbrcscarmessages.lib,binary:proto/js" proto/pbRcsCarMessages.proto

