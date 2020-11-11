#!/usr/bin/env bash
#  FUNDING_SECRET=xxx FUNDING_ADDRESS=xxx FUNDING_SEQUENCE=43 CURRENCY=LUK DOMAIN=Lukii FEE=1.002 FUNDING_AMOUNT=10000 ./scripts/generateVaultOffline.sh

set -e


#!/usr/bin/env bash

set -e

if [ -z $CURRENCY ]; then
	echo "CURRENCY not set"
	exit 1
fi

if [ -z $FUNDING_SEQUENCE ]; then
	echo "FUNDING_SEQUENCE not set"
	exit 1
fi

if [ -z $FUNDING_SECRET ]; then
	echo "FUNDING_SECRET not set"
	exit 1
fi

if [ -z $FUNDING_ADDRESS ]; then
	echo "FUNDING_ADDRESS not set"
	exit 1
fi

if [ -z $DOMAIN ]; then
	echo "FUNDING_ADDRESS not set"
	exit 1
fi

if [ -z $FEE ]; then
	echo "FUNDING_ADDRESS not set"
	exit 1
fi


if [ -z $FUNDING_AMOUNT ]; then
	echo "FUNDING_ADDRESS not set"
	exit 1
fi

echo "-> Generating wallets"
echo -n "* cold wallet: "
ripple-tools generate format=json offline=true export=cold_wallet.json
COLD_ADDRESS=$(cat cold_wallet.json | jq -r '.address')
COLD_SECRET=$(cat cold_wallet.json | jq -r '.secret')
echo ${COLD_ADDRESS}

echo -n "* hot wallet: "
ripple-tools generate format=json offline=true export=hot_wallet.json
HOT_ADDRESS=$(cat hot_wallet.json | jq -r '.address')
HOT_SECRET=$(cat hot_wallet.json | jq -r '.secret')
echo ${HOT_ADDRESS}

echo "* funding sequence: $FUNDING_SEQUENCE"

echo "-> generating transactions"
echo "* tx funding hot wallet"
ripple-tools send-payment \
	amount=50 to=$COLD_ADDRESS \
	fee=0.000012 sequence=$FUNDING_SEQUENCE  \
	address=$FUNDING_ADDRESS secret=$FUNDING_SECRET \
	format=json offline=true export=transactions.json

echo "* tx funding cold wallet"
ripple-tools send-payment \
	amount=50 to=$HOT_ADDRESS \
	fee=0.000012 sequence=$((FUNDING_SEQUENCE+1)) \
	address=$FUNDING_ADDRESS secret=$FUNDING_SECRET \
	format=json offline=true export=transactions.json

ripple-tools set-flag defaultRipple \
	address=$COLD_ADDRESS secret=$COLD_SECRET \
	fee=0.000012 sequence=1 \
	offline=true export=transactions.json

ripple-tools set-flag requireDestinationTag \
	address=$COLD_ADDRESS secret=$COLD_SECRET \
	fee=0.000012 sequence=2 \
	offline=true export=transactions.json

ripple-tools set-flag disallowIncomingXRP \
	address=$COLD_ADDRESS secret=$COLD_SECRET \
	fee=0.000012 sequence=3 \
	format=json offline=true export=transactions.json

ripple-tools set-fee $FEE\
	address=$COLD_ADDRESS secret=$COLD_SECRET \
	fee=0.000012 sequence=4 \
	offline=true export=transactions.json

ripple-tools set-domain \
	address=$COLD_ADDRESS secret=$COLD_SECRET \
	fee=0.000012 sequence=5 \
	offline=true export=transactions.json $DOMAIN-COLD

echo "-> done"

echo "* tx setting flags and trustlines on hot"

ripple-tools set-trust \
	address=$HOT_ADDRESS secret=$HOT_SECRET \
	counterparty=$COLD_ADDRESS currency=$CURRENCY \
	fee=0.000012 sequence=1 \
	format=json offline=true export=transactions.json

echo "* tx setting flags and trustlines on hot2"

ripple-tools set-domain \
	address=$HOT_ADDRESS secret=$HOT_SECRET \
	fee=0.000012 sequence=2 \
	offline=true export=transactions.json $DOMAIN-HOT

echo "-> done"

echo "* saving cold and hot to wallets/"

COLD_WALLET_REPO="wallets/cold_wallet_${CURRENCY}.json"
HOT_WALLET_REPO="wallets/hot_wallet_${CURRENCY}.json"

cp cold_wallet.json $COLD_WALLET_REPO
cp hot_wallet.json $HOT_WALLET_REPO

echo "-> done"

#!/bin/sh

COLD_WALLET=$(cat cold_wallet.json | jq -r '.address')
COLD_SECRET=$(cat cold_wallet.json | jq -r '.secret')
HOT_WALLET=$(cat hot_wallet.json | jq -r '.address')

ripple-tools send-payment \
	address=$COLD_WALLET secret=$COLD_SECRET \
	to=$HOT_WALLET amount=$FUNDING_AMOUNT currency=$CURRENCY \
	offline=true sequence=6 export=transactions.json
