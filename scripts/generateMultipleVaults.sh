#!/usr/bin/env bash

#FUNDING_SECRET=xxx FUNDING_ADDRESS=xxx SERVER="wss://s.altnet.rippletest.net:51233" ./scripts/generateMultipleVaults.sh

set -e

i=1

input="currencies.txt"
while IFS= read -r CURRENCY
do
	CURRENCY=$CURRENCY FUNDING_SEQUENCE=$i FUNDING_SECRET=$FUNDING_SECRET FUNDING_ADDRESS=$FUNDING_ADDRESS ./scripts/cold-hot.sh --server=$SERVER


	echo "-> submitting transactions"
	ripple-tools submit - --server=$SERVER < transactions.json

	echo "-> done"

	echo "-> funding hot"
	IFS=',' read -r -a currs <<< $CURRENCY
	curr=""
	SEQ=1

	for curr in "${currs[@]}"
	do
		echo "** [${curr}]: funding -- seq ${SEQ}"
		CURRENCY=$curr FUNDING_SEQUENCE=$SEQ FUNDING_SECRET=$FUNDING_SECRET FUNDING_ADDRESS=$FUNDING_ADDRESS SERVER=$SERVER ./scripts/fund.sh
		SEQ=$((SEQ + 1))
	done

	echo "-> done"
	i=$((i + 2))

done < "$input"
