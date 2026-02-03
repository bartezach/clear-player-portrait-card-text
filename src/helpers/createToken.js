// import * as dotenv from "dotenv";
// import fetch from "node-fetch";
// import { fileURLToPath } from "url";
// import path from "path";

// // fix for Windows
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const envPath = path.resolve(__dirname, "../../.env");
// // import secrets
// dotenv.config({ path: envPath });

// export async function login() {
//   var myHeaders = { "Content-Type": "application/json" };
//   myHeaders["Authorization"] =
//     "Basic " +
//     Buffer.from(
//       process.env.MPX_USERNAME + ":" + process.env.MPX_PASSWORD
//     ).toString("base64");

//   var requestOptions = {
//     method: "GET",
//     headers: myHeaders,
//     redirect: "follow"
//   };

//   const result = await fetch(
//     "https://identity.auth.theplatform.eu/idm/web/Authentication/signIn?schema=1.1",
//     requestOptions
//   )
//     .then((response) => response.json())
//     .catch((error) => console.log("error", error));
//   const token = result.signInResponse.token;
//   return token;
// }

export async function login(env) {
  const isProd = env.MPX_ENV === "prod";

  const username = isProd
    ? env.MPX_PROD_USERNAME
    : env.MPX_TEST_USERNAME;

  const password = isProd
    ? env.MPX_PROD_PASSWORD
    : env.MPX_TEST_PASSWORD;
  // console.log(username, password);
  const auth = btoa(`${username}:${password}`);

  const res = await fetch(
    "https://identity.auth.theplatform.eu/idm/web/Authentication/signIn?schema=1.1&form=json",
    { method: "GET", 
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      } 
    }
  );
  // console.log(await res.text());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MPX login failed: ${text}`);
  }
  
  const data = await res.json();
  
  if (!data?.signInResponse?.token) {
    throw new Error("MPX login failed: no token");
  }
  
  return data.signInResponse.token;
}

