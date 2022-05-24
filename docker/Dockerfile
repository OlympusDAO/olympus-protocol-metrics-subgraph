FROM node:16

# Install hardhat
COPY package.json .
COPY yarn.lock .
RUN yarn --frozen-lockfile

# Needs to be specified at runtime, or else the Alchemy API will fail with "must be authenticated!"
ENV ALCHEMY_API_KEY=""
COPY hardhat.config.js .
ENTRYPOINT npx hardhat node --fork "https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}"
