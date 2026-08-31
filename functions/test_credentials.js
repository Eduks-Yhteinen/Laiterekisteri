const { ConfidentialClientApplication } = require("@azure/msal-node");
const { OAuth2Client } = require("google-auth-library");


async function testIntune() {
  const msalConfig = {
    auth: {
      clientId: "9ecf38ba-133c-4334-9943-2386f58a3043",
      authority: `https://login.microsoftonline.com/bef3fad5-aded-4cc3-88ba-368ea46d8fb7`,
      clientSecret: "WDG8Q~acjrIxxujRq5uJaxQBzkdgxeCGaQuZ.aXI",
    }
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  try {
    const response = await cca.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
    console.log("✅ Intune Token Acquired!");
    
    // Quick test to Graph API
    const res = await fetch("https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=1", {
        headers: { "Authorization": `Bearer ${response.accessToken}` }
    });
    if (res.ok) {
        console.log("✅ Intune API is reachable!");
    } else {
        console.error("❌ Intune API Error:", res.statusText);
    }
  } catch (error) {
    console.error("❌ Error acquiring MS Graph token:", error.message);
  }
}

async function testGoogle() {
  const oAuth2Client = new OAuth2Client("831308198442-kkco0qal3s4lp7nd6iuapd8j8fmk8h1f.apps.googleusercontent.com", "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");
  oAuth2Client.setCredentials({ refresh_token: "1//04N4KEnm6AUgGCgYIARAAGAQSNwF-L9Irg7h5xK3tlYLp9XO326tDgnew_Jnk1zvxiZqlcd8UYFxYnCFXlkRlPkVufL4vET8QtJI" });
  
  try {
    const res = await oAuth2Client.request({ url: `https://admin.googleapis.com/admin/directory/v1/customer/my_customer/devices/chromeos?maxResults=1` });
    console.log("✅ Google API is reachable!");
  } catch (error) {
    console.error("❌ Google API Error:", JSON.stringify(error.response?.data || error.message));
  }
}

async function run() {
    await testIntune();
    await testGoogle();
}
run();
