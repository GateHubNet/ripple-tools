import * as fs from "fs";
import * as linereader from "readline";
import * as yargs from "yargs";
import {RippleGateway} from "./ripple";
import {assert, printKV, processTransaction, setUilsConfig, submit} from "./utils";

const args = process.argv.slice(2).filter(x => x.indexOf("=") > -1).map(x => `--${x}`).join(" ");
const ycmd = process.argv.slice(2).filter(x => x.indexOf("=") == -1). join(" ");
const cmd = process.argv[2];

const argv = yargs(ycmd + " " + args)
	.usage('Usage: $0 <command> [options]')
	.describe('address', 'wallet address')
	.string('address').global('address')
	.describe('secret', 'wallet secret')
	.string('secret').global('secret').implies('secret', 'address')
	.describe('format', 'output format')
	.string('format').default('format', 'json')
	.choices('format', ['yaml', 'json'])
	.describe('verbose', 'be verbose')
	.boolean('verbose').global('verbose')
	.describe('export', 'export transaction')
	.string('export').global('export').default("export", undefined)
	.describe('sequence', 'wallet sequence')
	.number('sequence').global('sequence').default('sequence', -1)
	.describe('fee', 'set transaction fee')
	.string('fee').global('fee').default('fee', undefined)
	.describe('offline', 'start ripple api in offline mode')
	.boolean('offline').default('offline', true)
	.describe('server', 'rippled server to use')
	.string('server').default('server', 'wss://s.altnet.rippletest.net:51233')
	.command('generate', 'Generate wallet')
	.command('set-flag <flag>', 'Set wallet flag')
	.command('set-fee <fee>', 'Set wallet fee')
	.command('set-domain <domain>', 'Set wallet domain')
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
	.command('submit-file', 'Submits raw transactions to ripple')
	.help('h').alias('h', 'help')
	.demand(1)
	.strict()
	.argv;

setUilsConfig({
	format: argv.format,
	filename: argv.export
});

const txOptions = {sequence: argv.sequence, maxLedgerVersion: 100000000, fee: undefined};

if (argv.offline) {
	txOptions.fee = "0.012"
}

if (argv.offline && argv.sequence == -1 &&
	cmd != "generate") {
	console.error("Tool mode cannot be offline and have no sequence");
}

RippleGateway.getApi(argv.offline, argv.server).then(async ripple => {

	if (!argv.offline && argv.sequence == -1 && argv.address) {
		const accountInfo = await ripple.getAccountInfo(argv.address);
		txOptions.sequence = accountInfo.sequence;
	}

	let tx;

	switch (cmd) {
		case 'generate':
		  const address = ripple.generateAddress();
		  printKV(address);
		  break;
		case 'set-flag':
		  assert(argv.address, 'wallet address must be set');

		  tx = await ripple.prepareSettings(argv.address, {[argv.flag]: true}, txOptions);
		  await processTransaction(ripple, argv, tx);
		  break;
		case 'set-fee':
		  assert(argv.address, 'wallet address must be set');

		  tx = await ripple.prepareSettings(argv.address, {transferRate: parseFloat(argv.fee)}, txOptions);
		  await processTransaction(ripple, argv, tx);
		  break;
		case 'set-domain':
		  assert(argv.address, 'wallet address must be set');

		  tx = await ripple.prepareSettings(argv.address, {domain: argv.domain}, txOptions);
		  await processTransaction(ripple, argv, tx);
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

		  tx = await ripple.preparePayment(argv.address, payment, txOptions);
		  await processTransaction(ripple, argv, tx);
		  break;
		case 'get-info':
		  assert(argv.address, 'address must be set');
		  const info = await ripple.getAccountInfo(argv.address);
		  printKV(info);
		  break;
		case 'get-balances':
		  assert(argv.address, 'address must be set');

		  const balances = await ripple.getBalances(argv.address);
		  printKV(balances);
		  return;

		case 'set-trust':
		  assert(argv.address, 'address must be set');

		  tx = await ripple.prepareTrustline(argv.address, {
			currency: argv.currency,
			counterparty: argv.counterparty,
			limit: argv.limit.toString(),
			qualityIn: argv.qualityIn,
			qualityOut: argv.qualityOut
		  }, txOptions);
		  await processTransaction(ripple, argv, tx);
		  break;
		case 'submit-file':
			assert(argv.export, 'filename must be set');

			let reader: any = linereader.createInterface({
				input: fs.createReadStream(argv.export),
				crlfDelay: Infinity
			});

			for await (const line of reader) {
				await submit(ripple, JSON.parse(line));
			}
			break;

		console.log("DONE");
	}


}).then(() => process.exit(0)).catch(e => console.log(e));
