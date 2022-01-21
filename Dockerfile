# FROM node:16-alpine
# RUN apk add --update alpine-sdk --no-cache python3 py-pip linux-headers net-tools valgrind \
# 	&& ln -sf python3 /usr/bin/python

FROM node:latest AS stage-one
# Install DEB dependencies and others.
RUN \
	set -x \
	&& apt-get update \
	&& apt-get install -y net-tools build-essential valgrind \
	&& apt-get install -y python3-pip

# Install PM2 globally
# RUN npm install pm2@latest -g
RUN mkdir -p /home/buddyclub/api/node_modules && chown -R node:node /home/buddyclub/api

WORKDIR /home/buddyclub/api
COPY package.json ./
COPY yarn.lock ./
COPY secure-connect-buddy.zip ./
USER node
RUN yarn install

COPY --chown=node:node . .

# COPY . .
COPY .env.production .env

# RUN yarn build

ENV NODE_ENV production
EXPOSE 3008
# Run process via pm2
# CMD ["pm2-runtime", "start", "process_prod.json"]

CMD [ "node", "src/g.js"]
