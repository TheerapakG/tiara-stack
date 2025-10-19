FROM node:22

RUN apt update
RUN apt install -y libargon2-1 zstd

COPY ./cert/ca-certificate.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

RUN npm install -g playwright
RUN npx playwright install --with-deps chromium
RUN echo "NODE_PATH=$(npm root -g)" >> /etc/environment

COPY ./dist.tar.zst ./dist.tar.zst

CMD tar -axf ./dist.tar.zst && NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt node --use-openssl-ca ./dist/runServer.js
