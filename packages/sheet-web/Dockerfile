FROM node:22-slim AS extractor

RUN apt-get update \
  && apt-get install -y --no-install-recommends zstd \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./dist.tar.zst ./dist.tar.zst
RUN tar -axf ./dist.tar.zst && rm ./dist.tar.zst

FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY ./cert/ca-certificate.crt /usr/local/share/ca-certificates/tiarastack.crt
RUN update-ca-certificates

WORKDIR /app

COPY --from=extractor /app ./

CMD ["sh", "-c", "NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt exec node --use-openssl-ca --enable-source-maps ./.output/server/index.mjs"]
