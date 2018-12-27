#!/usr/bin/env node

'use strict';

const readline = require('readline-promise');
const fs = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const yargs = require('yargs');
const YAML = require('yamljs');

const RippleAPI = require('ripple-lib').RippleAPI;

const args = process.argv.slice(2).join(' ');

const argv = yargs(args)
  .env('RIPPLE_TOOLS')
  .usage('Usage: $0 <command> [options]')
  .describe('address', 'wallet address')
  .string('address').global('address')
  .describe('secret', 'wallet secret')
  .string('secret').global('secret').implies('secret', 'address')
  .describe('format', 'output format')
  .string('format').default('format', 'yaml')
  .choices('format', ['yaml', 'json'])
  .describe('verbose', 'be verbose')
  .boolean('verbose').global('verbose')
  .describe('export', 'export transaction')
  .boolean('export').global('export')
  .describe('sequence', 'wallet sequence')
  .number('sequence').global('sequence')
  .describe('fee', 'set transaction fee')
  .string('fee').global('fee').default(undefined)
  .describe('offline', 'start ripple api in offline mode')
  .boolean('offline').global('offline')
  .describe('server', 'rippled server to use')
  .string('server').default('server', 'wss://s1.ripple.com:443')
  .command('generate', 'Generate wallet')
  .command('set-flag <flag>', 'Set wallet flag')
  .command('set-fee <fee>', 'Set wallet fee')
  .command('set-trust', 'Set trustline', yargs => {
    return yargs
      .describe('currency', 'Currency to trust')
      .string('currency').require('currency')
      .describe('counterparty', 'Address to trust')
      .string('counterparty').require('counterparty')
      .describe('limit')
      .number('limit').default('limit', 1000000000)
      .describe('quality-in', 'Incoming balances on this trustline are valued at this ratio')
      .number('quality-in').default('quality-in', 1)
      .describe('quality-out', 'Outgoing balances on this trustline are valued at this ratio')
      .number('quality-out').default('quality-out', 1)
  })
  .command('get-info', 'Gets account info')
  .command('get-balances', 'Gets account balances')
  .command('send-payment', 'Sends payment', yargs => {
    return yargs
      .describe('to', 'where to send payment')
      .string('to').require('to')
      .describe('amount', 'amount to send')
      .string('amount').require('amount')
      .describe('currency', 'currency to send')
      .string('currency').default('currency', 'XRP')
      .describe('memo', 'memo to add to transaction (ex. message:text/plain:value)')
      .string('memo');
  })
  .command('submit [tx]', 'Submit raw transactions to ripple')
  .help('h').alias('h', 'help')
  .demand(1)
  .strict()
  .argv;

const command = _.first(argv._);
let tx;

function getRippleAPI(offline, server) {
  if (offline) {
    const ripple = new RippleAPI();
    return Promise.resolve(ripple);
  } else {
    const ripple = new RippleAPI({server});
    return ripple.connect().then(() => ripple);
  }
}

let ripple = getRippleAPI(argv.offline, argv.server);

function printKV(format, data) {
  switch(format) {
    case 'json':
      console.log(JSON.stringify(data));
      break;
    default:
      console.log(YAML.stringify(data, 2));
  }
}

function assert(value, message) {
  if (!value) {
    console.error(message);
    process.exit(1);
  }
}

function submit(ripple, transaction) {
  return Promise.all([
    ripple.submit(transaction.signedTransaction),
    ripple.getLedgerVersion()
  ]).spread((result, version) => {
    if (
      result.resultCode !== 'tesSUCCESS' &&
      result.resultCode !== 'terQUEUED'
    ) {
      throw new Error('problem submiting transaction: ' + result.resultCode);
    }

    const waitSubmitted = () => {
      return ripple.getTransaction(
        transaction.id,
        {
          minLedgerVersion: version,
          maxLedgerVersion: version + 10
        }
      ).then(tx => {
        if (tx.outcome.result !== 'tesSUCCESS') {
          throw new Error('problem submitting transaction');
        }
      }).catch(err => {
        if (
          err instanceof ripple.errors.MissingLedgerHistoryError ||
          err instanceof ripple.errors.PendingLedgerVersionError
        ) {
          return Promise.delay(1000).then(() => waitSubmitted());
        } else if (err instanceof ripple.errors.NotFoundError) {
          throw new Error('problem processing transaction' + err);
        } else {
          throw new Error('connection error');
        }
      });
    }

    return waitSubmitted();
  }).catch(err => {
    if (err.name === 'RippledError') {
      console.error("Error, resubmit", err);

      return Promise.delay(1000).then(() => getRippleAPI(false, argv.server).then(ripple => {
        return submit(ripple, transaction);
      }));
    }

    throw err;
  });
}

const txOptions = _.omitBy({sequence: argv.sequence, maxLedgerVersion: 100000000, fee: argv.fee}, _.isUndefined);

getRippleAPI(argv.offline, argv.server).then(ripple => {
  switch(command) {
    case 'generate':
      const address = ripple.generateAddress();
      printKV(argv.format, address);
      break;
    case 'set-flag':
      assert(argv.address, 'wallet address must be set');

      tx = ripple.prepareSettings(argv.address, {[argv.flag]: true}, txOptions);
      break;
    case 'set-fee':
      assert(argv.address, 'wallet address must be set');

      tx = ripple.prepareSettings(argv.address, {transferRate: argv.fee}, txOptions);
      break;
    case 'send-payment':
      assert(argv.address, 'sending address must be set');

      const payment = {
        source: {
          address: argv.address,
          maxAmount: {
            value: (argv.amount.toString() * 1.006).toString(),
            currency: argv.currency
          }
        },
        destination: {
          address: argv.to,
          amount: {
            value: argv.amount.toString(),
            currency: argv.currency
          }
        }
      };

      if (argv.memo) {
        if (!Array.isArray(argv.memo)) {
          argv.memo = [argv.memo];
        }

        payment.memos = argv.memo.map(memo => {
          let type = memo.split(':')[0] || '';
          let format = memo.split(':').splice(1, 1).join();
          let data = memo.split(':').splice(2).join(':');

          if (!format || !data) {
            data = type;
            type = 'messagge';
            format = 'text/plain';
          }

          if (type === 'application/json') {
            data = JSON.parse(data);
          }

          return {type, format, data};
        });
      }

      tx = ripple.preparePayment(argv.address, payment, txOptions);
      break;
    case 'get-info':
      assert(argv.address, 'address must be set');

      return ripple.getAccountInfo(argv.address).then(info => {
        printKV(argv.format, info)
      });
    case 'get-balances':
      assert(argv.address, 'address must be set');

      return ripple.getBalances(argv.address).then(balances => {
        printKV(argv.format, balances)
      });
    case 'set-trust':
      assert(argv.address, 'address must be set');

      tx = ripple.prepareTrustline(argv.address, {
        currency: argv.currency,
        counterparty: argv.counterparty,
        limit: argv.limit.toString(),
        qualityIn: argv.qualityIn,
        qualityOut: argv.qualityOut
      }, txOptions);
      break;
    case 'submit':
      if (argv.tx === '-') {
        let previous = Promise.resolve();
        return readline.createInterface({
  				input: process.stdin,
				  output: process.stdout,
				  terminal: false
        }).each(line => {
          return previous = previous.then(() => {
            let tx;

            try {
              tx = JSON.parse(line);
            } catch(e) {
              console.log("Skipping line", line);
              return;
            }

            console.log("Submiting transaction")
            printKV(argv.format, JSON.parse(tx.txJSON))
            return submit(ripple, tx);
          })
        });
      }
  }

  if (tx) {
    return tx.then(tx => {
      if (argv.secret) {
        _.extend(tx, ripple.sign(tx.txJSON, argv.secret));
      }

      delete tx.instructions.maxLedgerVersion;

      if (argv.export) {
        printKV(argv.format, tx);
      } else {
        console.log(`sending transaction: ${tx.id}`);
        return submit(ripple, tx).catch(err => {
          console.error('Cannot send transaction', err);
          process.exit(1);
        }).then(() => console.log(`transaction sent: ${tx.id}`));
      }
    }).catch(err => {
      console.error('Cannot prepare transaction', err);
      process.exit(1);
    });
  }
}).then(() => process.exit(0)).catch(err => {
  console.log(err);
  process.exit(1)
});
