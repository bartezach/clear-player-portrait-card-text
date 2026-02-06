import { login } from "./helpers/createToken.js";

console.log("Worker file loaded");

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		

		if (url.pathname === "/__scheduled") {
			console.log("Manually schedule trigger");
			ctx.waitUntil(run(env));
			return new Response("Schedule event ran");
		}
	},
	
	async scheduled(_, env, ctx) {
		console.log("Scheduled trigger received");
		await run(env);
	}
};

async function run(env) {
	console.log("Portrait card cleanup triggered");

	const thirty_days_ms = 30 * 24 * 60 * 60 * 1000;
	const cutoff = Date.now() - thirty_days_ms;

	const token = await login(env);
	console.log("Got token");
	const account = env.MPX_ENV === "prod" ? "RTE Prod - Prod" : "RTE Test - Integration";

	const items = await queryExpiredPortraitCardText(token, account, cutoff);

	console.log(`Found ${items.length} items to process`);

	for (const item of items) {
		try {
			await clearPortraitCardText(item, token, account, env);
		} catch (err) {
			console.error(`Failed to process item ${item.id}`, err); 
		}
	}

	console.log(`Finished processing ${items.length} items`);
}


async function queryExpiredPortraitCardText(token, account, cutoff){
	const BASE_URL =
		"https://data.entertainment.tv.theplatform.eu/entertainment/data/Program";
	
	const pageSize = 100;
	let startIndex = 1;
	let allItems = [];

	while (true) {
		const url = new URL(BASE_URL);

		url.searchParams.set("schema", "2.0");
  		url.searchParams.set("account", account);
		url.searchParams.set("token", token)
  		url.searchParams.set(
    		"byCustomValue",
    		`{rte$portraitCardTextUpdated}{~${cutoff}}`
  		);
		url.searchParams.set("form", "json");
		url.searchParams.set("count", pageSize);
		url.searchParams.set("startIndex", startIndex);
		
		console.log(`Querying MPX: startIndex=${startIndex}`);

		console.log(url);
		const res = await fetch(url, {
			headers: { Accept: "application/json" }
		});

		const text = await res.text();
		let data;

		try {
			data = JSON.parse(text);
		} catch (err) {
			console.error("Failed to parse MPX JSON. Response was:\n", text);
			throw new Error("MPX query failed: response not JSON");
		}

		const entries = data.entries ?? [];
		allItems.push(...entries);

		console.log(`Fetched ${entries.length} items (total ${allItems.length})`);

		if (allItems.length > 5000) {
			throw new Error("Process stopped: Too many items returned");
		}

		if (entries.length < pageSize) {
			break;
		}

		startIndex += pageSize;
	}
	
	return allItems
}

async function clearPortraitCardText(item, token, account, env) {
	const fieldsToClear = {
		"rte$portraitCardText": "",
		"rte$portraitCardTextUpdated": ""
	};

	if (env.DRY_RUN === "true") {
		console.log(`[DRY RUN] would clear portrait card text for item ${item.id}`);
		return;
	}


	if (item.locked === true) {
		console.log(`Unlocking ${item.id}`);
		await updateProgram(item.id, token, account, fieldsToClear, false);

		console.log(`Re-locking ${item.id}`);
		await updateProgram(item.id, token, account, null, true);
	} else {
		console.log(`Clearing portrait card text for ${item.id}`);
		await updateProgram(item.id, token, account, fieldsToClear);
	}
}

async function updateProgram(id, token, account, fields, lock) {
	const url = new URL(
		`https://data.entertainment.tv.theplatform.eu/entertainment/data/Program/${id}`
	);

	url.searchParams.set("schema", "2.0");
  	url.searchParams.set("account", account);
	url.searchParams.set("token", token)

	if (lock === true) url.searchParams.set("lock", "true");
	if (lock === false) url.searchParams.set("lock", "false");

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			Accept: "application/json"
		},
		body: JSON.stringify(fields ?? {})
	});

	const text = await res.text();

	try {
		const data = JSON.parse(text);
		return data;
	} catch (err) {
		console.error(`Failed to parse MPX JSON for item ${id}. Response was:\n`, text);
		throw new Error(`Failed to parse MPX JSON for item ${id}`); 
	}
}

// /**
//  * Welcome to Cloudflare Workers!
//  *
//  * This is a template for a Scheduled Worker: a Worker that can run on a
//  * configurable interval:
//  * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
//  *
//  * - Run `npm run dev` in your terminal to start a development server
//  * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
//  * - Run `npm run deploy` to publish your worker
//  *
//  * Learn more at https://developers.cloudflare.com/workers/
//  */

// export default {
// 	async fetch(req) {
// 		const url = new URL(req.url)
// 		url.pathname = "/__scheduled";
// 		url.searchParams.append("cron", "* * * * *");
// 		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
// 	},

// 	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
// 	// [[triggers]] configuration.
// 	async scheduled(event, env, ctx) {
// 		// A Cron Trigger can make requests to other endpoints on the Internet,
// 		// publish to a Queue, query a D1 Database, and much more.
// 		//
// 		// We'll keep it simple and make an API call to a Cloudflare API:
// 		let resp = await fetch('https://api.cloudflare.com/client/v4/ips');
// 		let wasSuccessful = resp.ok ? 'success' : 'fail';

// 		// You could store this result in KV, write to a D1 Database, or publish to a Queue.
// 		// In this template, we'll just log the result:
// 		console.log(`trigger fired at ${event.cron}: ${wasSuccessful}`);
// 	},
// };
