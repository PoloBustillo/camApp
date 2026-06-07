FROM jrottenberg/ffmpeg:latest

RUN apk add --no-cache jq bash

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
