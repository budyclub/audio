#!/usr/bin/env bash

export LISTEN_PORT=${LISTEN_PORT:="3008"}
export DEBUG=${DEBUG:="mediasoup:INFO* *WARN* *ERROR*"}
export MEDIASOUP_LISTEN_IP=${MEDIASOUP_LISTEN_IP:="0.0.0.0"}
export MEDIASOUP_ANNOUNCED_IP=${MEDIASOUP_ANNOUNCED_IP:="192.168.49.176"}
export MEDIASOUP_MIN_PORT=${MEDIASOUP_MIN_PORT:="20000"}
export MEDIASOUP_MAX_PORT=${MEDIASOUP_MAX_PORT:="20020"}
# Valgrind related options.
export MEDIASOUP_USE_VALGRIND=${MEDIASOUP_USE_VALGRIND:="false"}
export MEDIASOUP_VALGRIND_OPTIONS=${MEDIASOUP_VALGRIND_OPTIONS:="--leak-check=full --track-fds=yes --log-file=/storage/mediasoup_valgrind_%p.log"}

docker run \
	--name=budyclub \
	-p ${LISTEN_PORT}:${LISTEN_PORT}/tcp \
	-p ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}:${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}/udp \
	-p ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}:${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}/tcp \
	-v ${PWD}:/storage \
	-v ${MEDIASOUP_SRC}:/mediasoup-src \
	--init \
	-e DEBUG \
	-e MEDIASOUP_LISTEN_IP \
	-e MEDIASOUP_ANNOUNCED_IP \
	-e MEDIASOUP_MIN_PORT \
	-e MEDIASOUP_MAX_PORT \
	-e MEDIASOUP_USE_VALGRIND \
	-e MEDIASOUP_VALGRIND_OPTIONS \
	-e MEDIASOUP_WORKER_BIN \
	-t \
	--rm \
	translite/buddy:latest
