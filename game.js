const SUPABASE_URL = "https://elxarqmedqgnighvdqsb.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HS_4nqHQHu_p8XTvoZaeww_dlKUITE7";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

let currentUser = null;
let accountResetVersion = 0;
let autoRebirthPurchased = false;
let autoRebirthEnabled = false;
let autoRebirthTarget = 1;

async function getCurrentUser(){

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    currentUser = user;

    return user;
}

document
    .getElementById("createAccountButton")
    .addEventListener("click", createAccount);

document
    .getElementById("loginButton")
    .addEventListener("click", loginAccount);

document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {

        if(!currentUser){

            document
                .getElementById("accountScreen")
                .classList.remove("hidden");

            return;
        }

        await supabaseClient.auth.signOut();

        currentUser = null;
        document
            .getElementById("adminButton")
            .classList
            .add("hidden");

        document
            .getElementById("adminPanel")
            .classList
            .add("hidden");

        document
            .getElementById("accountScreen")
            .classList.remove("hidden");

        document
            .getElementById("gameScreen")
            .classList.add("hidden");

        document
            .getElementById("playerUsername")
            .textContent = "";

        document
            .getElementById("logoutButton")
            .textContent = "LOGIN";

    });   

async function createAccount(){

    const usernameInput =
        document.getElementById("usernameInput");

    const emailInput =
        document.getElementById("emailInput");

    const passwordInput =
        document.getElementById("passwordInput");

    const accountError =
        document.getElementById("accountError");

    const username =
        usernameInput.value.trim();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    accountError.textContent = "";

    if(username.length < 3){
        accountError.textContent =
            "Username must be at least 3 characters.";
        return;
    }

    if(username.length > 16){
        accountError.textContent =
            "Username must be 16 characters or less.";
        return;
    }

    if(!email){
        accountError.textContent =
            "Please enter your email.";
        return;
    }

    if(password.length < 6){
        accountError.textContent =
            "Password must be at least 6 characters.";
        return;
    }

    const {
        data: existingUsername,
        error: usernameCheckError
    } = await supabaseClient
        .from("usernames")
        .select("username")
        .eq("username", username)
        .maybeSingle();

    if(usernameCheckError){
        console.error(
            "Username check error:",
            usernameCheckError
        );

        accountError.textContent =
            "Unable to check username.";

        return;
    }

    if(existingUsername){
        accountError.textContent =
            "Username already taken.";
        return;
    }

    const {
        data,
        error
    } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if(error){
        console.error(
            "Account creation error:",
            error
        );

        accountError.textContent =
            error.message;

        return;
    }

    currentUser = data.user;

    const localSave =
        localStorage.getItem(SAVE_KEY);

    let localGameData = null;

    if(localSave){

        try{

            localGameData =
                JSON.parse(localSave);

        }catch(e){

            console.error(
                "Local save migration error:",
                e
            );

        }

    }

    const {
        error: usernameError
    } = await supabaseClient
        .from("usernames")
        .insert({
            username: username,
            user_id: currentUser.id
        });

    if(usernameError){

        console.error(
            "Username creation error:",
            usernameError
        );

        accountError.textContent =
            "Unable to save username.";

        return;
    }

    localStorage.setItem(
        "playerUsername",
        username
    );

    document
        .getElementById("playerUsername")
        .textContent = username;

    document
        .getElementById("accountScreen")
        .style.display = "none";

    document
        .getElementById("gameScreen")
        .classList.remove("hidden");

    await load();

    updateUI();

    await saveLeaderboardStats();
    await loadLeaderboards();
}

async function loginAccount(){

    const email =
        document.getElementById("emailInput").value.trim();

    const password =
        document.getElementById("passwordInput").value;

    const accountError =
        document.getElementById("accountError");

    accountError.textContent = "";

    if(!email){
        accountError.textContent =
            "Please enter your email.";
        return;
    }

    if(!password){
        accountError.textContent =
            "Please enter your password.";
        return;
    }

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if(error){

        console.error(
            "Login error:",
            error
        );

        accountError.textContent =
            "Incorrect email or password.";

        return;
    }

    currentUser = data.user;
    await checkAdmin();

    document
        .getElementById("logoutButton")
        .textContent = "LOG OUT";

    const {
        data: usernameData,
        error: usernameError
    } = await supabaseClient
        .from("usernames")
        .select("username")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if(usernameError){

        console.error(
            "Username lookup error:",
            usernameError
        );

        accountError.textContent =
            "Unable to load account.";

        return;
    }

    if(usernameData){

        localStorage.setItem(
            "playerUsername",
            usernameData.username
        );

        document
            .getElementById("playerUsername")
            .textContent =
            usernameData.username;
    }

    document
        .getElementById("accountScreen")
        .style.display = "none";

    document
        .getElementById("gameScreen")
        .classList.remove("hidden");

    await load();

    updateUI();

    await saveLeaderboardStats();
}

const LEADERBOARD_REFRESH_INTERVAL = 60 * 1000;

async function saveLeaderboardStats(){

    if(!currentUser){
        return;
    }

    // Don't allow an account marked for reset
    // to overwrite the leaderboard with old data.
    if(accountResetVersion !== 0){
        console.log(
            "Leaderboard save blocked: account is being reset."
        );
        return;
    }

    const username =
        localStorage.getItem("playerUsername");

    const {
        error
    } = await supabaseClient
        .from("leaderboards")
        .upsert({
            user_id: currentUser.id,
            username: username,
            eggs_hatched: totalHatches,
            coins: coins,
            rebirths: rebirths,
            playtime: playTime,
            updated_at: new Date().toISOString()
        });

    if(error){

        console.error(
            "Leaderboard save error:",
            error
        );

        return;
    }

    console.log(
        "Leaderboard stats saved!"
    );
}
async function initializeLeaderboard(){

    await getCurrentUser();

    if(!currentUser){
        return;
    }

    await saveLeaderboardStats();

    await loadLeaderboards();
}       

async function loadLeaderboards(){

    const categories = [
        {
            id: "eggsLeaderboard",
            column: "eggs_hatched"
        },
        {
            id: "coinsLeaderboard",

            column: "coins"
        },
        {
            id: "rebirthsLeaderboard",
            column: "rebirths"
        },
        {
            id: "playtimeLeaderboard",
            column: "playtime"
        }
    ];

    for(const category of categories){

        const {
            data,
            error
        } = await supabaseClient
            .from("leaderboards")
            .select("username," + category.column)
            .order(category.column, {
                ascending: false
            })
            .limit(10);

        const element =
            document.getElementById(category.id);

        if(!element){
            continue;
        }

        if(error){

            console.error(
                "Leaderboard load error:",
                error
            );

            element.innerHTML =
                "<p>Unable to load leaderboard.</p>";

            continue;
        }

        if(!data || data.length === 0){

            element.innerHTML =
                "<p>No players yet.</p>";

            continue;
        }

        element.innerHTML =
            data.map((player, index) => {

                return `
                    <div class="leaderboard-entry">

                        <span class="leaderboard-rank">
                            #${index + 1}
                        </span>

                        <span class="leaderboard-name">
                            ${player.username}
                        </span>

                        <span class="leaderboard-value">
                            ${formatLeaderboardValue(
                                player[category.column],
                                category.column
                            )}
                        </span>

                    </div>
                `;

            }).join("");
    }

    const updated =
        document.getElementById(
            "leaderboardUpdated"
        );

    if(updated){

        updated.textContent =
            "Last updated: " +
            new Date().toLocaleTimeString();
    }
}

function formatLeaderboardValue(value, type){

    if(type === "playtime"){

        const seconds =
            Number(value) || 0;

        const hours =
            Math.floor(seconds / 3600);

        const minutes =
            Math.floor(
                (seconds % 3600) / 60
            );

        return `${hours}h ${minutes}m`;
    }

    return formatCoins(value);
}

const SAVE_KEY = "petHatchersBrowserV2";

let coins = 0;
let rebirths = 0;
let rebirthCost = 10000;
let selectedRebirthAmount = 1;
let gems = 0;
let rebirthUpgradeLevel = 0;
const MAX_REBIRTH_UPGRADE = 15;

let adminTargetUserId = null;
let adminTargetUsername = null;

let clickSpeedLevel = 0;
let multiplierLevel = 0;
let hatchAmountLevel = 0;
let luckLevel = 0;
let equipUpgradeLevel = 0;
let clickBoostActive = false;
let clickBoostEndTime = 0;

let shopPurchases = 0;
let machineCrafts = 0;
let goldenCrafts = 0;
let rainbowCrafts = 0;
let darkMatterCrafts = 0;
let superiorCrafts = 0;

let clickBoostCost = 250000;
let mysteryBoxCost = 1000000;
let luckyBoostCost = 500000;
let shopClickMultiplierCost = 1000000;

let luckyBoostActive = false;
let luckyBoostEndTime = 0;

let unlockedAchievements = new Set();
// CLICK SKINS

const clickSkins = {

    "Classic": {
        emoji: "🖱️",
        multiplier: 1,
        cost: 0
    },

    "Fire": {
        emoji: "🔥",
        multiplier: 1.1,
        cost: 10000
    },

    "Ice": {
        emoji: "❄️",
        multiplier: 1.2,
        cost: 250000
    },

    "Lightning": {
        emoji: "⚡",
        multiplier: 1.5,
        cost: 2000000
    },

    "Rainbow": {
        emoji: "🌈",
        multiplier: 2,
        cost: 1000000000
    },

    "Diamond": {
        emoji: "💎",
        multiplier: 3,
        cost: 500000000000
    },

};

let ownedClickSkins = new Set(["Classic"]);
let equippedClickSkin = "Classic";
const achievements = [
    "First Hatch",
    "Hatch 10 Eggs",
    "Hatch 100 Eggs",
    "Hatch 1,000 Eggs",
    "Hatch 10,000 Eggs",
    "Hatch 100,000 Eggs",
    "Hatch 1,000,000 Eggs",
    "Hatch 10,000,000 Eggs",

    "Discover 10 Pets",
    "Discover 25 Pets",
    "Discover 50 Pets",
    "Discover 100 Pets",
    "Discover 150 Pets",
    "Discover All Pets",

    "Hatch Every Starter Egg Pet",
    "Unlock Futuristic Egg",
    "Hatch 100 Futuristic Pets",
    "Hatch 1,000 Futuristic Pets",
    "Hatch Every Futuristic Egg Pet",

    "Hatch an Uncommon Pet",
    "Hatch an Epic Pet",
    "Hatch a Legendary Pet",
    "Hatch a Mythic Pet",
    "Hatch an Ancient Pet",
    "Hatch a Celestial Pet",

    "Hatch a Shiny Pet",
    "Hatch a Golden Pet",
    "Hatch a Rainbow Pet",
    "Hatch a Shiny Golden Pet",
    "Hatch a Shiny Rainbow Pet",
    "Hatch a Dark Matter Pet",
    "Hatch a Shiny Dark Matter Pet",
    "Obtain a Superior Pet",
    "Obtain a Shiny Superior Pet",

    "Lucky Hatch",
    "Very Lucky",
    "Insanely Lucky",
    "Luck Master",
    "Maximum Luck",

    "10 Hatch Streak",
    "25 Hatch Streak",
    "50 Hatch Streak",
    "100 Hatch Streak",
    "250 Hatch Streak",
    "500 Hatch Streak",
    "1,000 Hatch Streak",

    "Earn 1,000 Coins",
    "Earn 1,000,000 Coins",
    "Earn 1,000,000,000 Coins",
    "Earn 1 Trillion Coins",
    "Earn 1 Quadrillion Coins",

    "Obtain 100 Gems",
    "Obtain 1,000 Gems",
    "Obtain 10,000 Gems",
    "Obtain 100,000 Gems",
    "Gem Collector",
    "Gem Hoarder",

    "First Rebirth",
    "10 Rebirths",
    "50 Rebirths",
    "100 Rebirths",
    "500 Rebirths",
    "1,000 Rebirths",
    "10,000 Rebirths",
    "Rebirth Master",

    "Own 10 Pets",
    "Own 50 Pets",
    "Own 100 Pets",
    "Own 500 Pets",
    "Own 1,000 Pets",
    "Own 5,000 Pets",
    "Own 10,000 Pets",

    "Level 5 Pet",
    "Level 10 Pet",
    "Level 25 Pet",
    "Level 50 Pet",
    "Level 100 Pet",

    "Equip Your First Pet",
    "Equip 3 Pets",
    "Equip 4 Pets",
    "Equip 5 Pets",
    "Full Team",
    "Ultimate Team",

    "Favourite Your First Pet",
    "Favourite 10 Pets",
    "Favourite 25 Pets",
    "Favourite Collector",

    "First Machine Craft",
    "Craft 10 Pets",
    "Craft 100 Pets",
    "Craft 1,000 Pets",
    "Golden Crafter",
    "Rainbow Crafter",
    "Dark Matter Crafter",
    "Superior Crafter",
    "Craft All",

    "First Shop Purchase",
    "Buy 5 Shop Items",
    "Buy 25 Shop Items",
    "Buy 100 Shop Items",

    "Reach 2x Shop Multiplier",
    "Reach 5x Shop Multiplier",
    "Reach 10x Shop Multiplier",

    "Reach 10x Click Multiplier",
    "Activate 2x Coins Boost",
    "Activate Lucky Boost",
    "Activate Both Boosts",
    "Boost Addict",

    "Open Your First Mystery Box",
    "Open 10 Mystery Boxes",
    "Open 100 Mystery Boxes",
    "Open 1,000 Mystery Boxes",
    "Mystery Box Master",
    "Hit a Jackpot",
    "Hit a Mega Jackpot",
    "Get a Rebirth From a Box",
    "Get 2 Rebirths From a Box",

    "Encounter Embryon",
    "Catch Embryon",
    "Catch Embryon Twice",
    "Catch Embryon 3 Times",
    "Embryon Remembers You",
    "Obtain Shiny Embryon",
    "Obtain Golden Embryon",
    "Obtain Rainbow Embryon",
    "Obtain Dark Matter Embryon",
    "Obtain Shiny Dark Matter Embryon",
    "Collect Every Embryon",

    "Obtain Your First Click Skin",
    "Own 5 Click Skins",
    "Own Every Click Skin",
    "Obtain the Mystery Click Skin",
    "Obtain the Embryon Click Skin",

    "Hatch Robot",
    "Hatch Cyber Cat",
    "Hatch Neon Fox",
    "Hatch Mecha Dragon",
    "Hatch Quantum Phoenix",
    "Hatch Galaxy Titan",
    "Hatch Void Emperor",
    "Hatch Prototype",

    "Own 10 Superior Pets",
    "Own a Shiny Superior",

    "Discover Every Pet",
    "Max Everything",
    "Pet Hatcher Legend",
    "The Ultimate Hatcher",

    "Obtain Mystorius",
    "Obtain Shiny Mystorius",
    "Obtain Golden Mystorius",
    "Obtain Rainbow Mystorius",
    "Obtain Dark Matter Mystorius",
    "Obtain Shiny Golden Mystorius",
    "Obtain Shiny Rainbow Mystorius",
    "Obtain Shiny Dark Matter Mystorius",

    "Obtain Naruto",
    "Obtain Luffy",
    "Obtain Denji",
    "Obtain Gojo",
    "Obtain Vegeta",
    "Obtain Sun Jin Woo",
    "Obtain MUI Goku",
    "Obtain Shenron"
];

function renderAchievements(){

    const list =
        document.getElementById("achievementList");

    const unlockedCount =
        document.getElementById("achievementUnlockedCount");

    const totalCount =
        document.getElementById("achievementTotalCount");

    if(!list) return;

    list.innerHTML = "";

    for(const achievement of achievements){

        const unlocked =
            unlockedAchievements.has(achievement);

        const card =
            document.createElement("div");

        card.className =
            "achievement-card" +
            (unlocked ? " unlocked" : "");

        card.innerHTML = `
            <span>${unlocked ? "🏆" : "🔒"}</span>

            <strong>${achievement}</strong>

            <b>
                ${unlocked ? "🏆 UNLOCKED" : "🔒 LOCKED"}
            </b>
        `;

        list.appendChild(card);
    }

    unlockedCount.textContent =
        unlockedAchievements.size;

    totalCount.textContent =
        achievements.length;
}

let notificationQueue = [];
let notificationShowing = false;

function showNotification(title, message){

    if(notificationShowing){
        return;
    }

    if(notificationQueue.length > 0){
        return;
    }

    notificationQueue.push({
        title,
        message
    });

    processNotificationQueue();
}

function processNotificationQueue(){

    if(notificationShowing){
        return;
    }

    if(notificationQueue.length === 0){
        return;
    }

    notificationShowing = true;

    const center =
        document.getElementById("notificationCenter");

    if(!center){
        notificationShowing = false;
        return;
    }

    const data =
        notificationQueue.shift();

    const notification =
        document.createElement("div");

    notification.className =
        "game-notification";

    notification.innerHTML = `
        <strong>${data.title}</strong>
        <small>${data.message}</small>
    `;

    center.appendChild(notification);

    setTimeout(() => {

        notification.remove();

        notificationShowing = false;

        processNotificationQueue();

    }, 4200);
}

function unlockAchievement(name){

    if(!achievements.includes(name)){
        return;
    }

    if(unlockedAchievements.has(name)){
        return;
    }

    unlockedAchievements.add(name);

    resultEl.textContent =
        `🏆 ACHIEVEMENT UNLOCKED! ${name}`;

    showNotification(
        "🏆 Achievement Unlocked!",
        name
    );

    renderAchievements();
    save();
}

let shopClickMultiplier = 1;

const MAX_SHOP_CLICK_MULTIPLIER = 20;

const MAX_MULTIPLIER_LEVEL = 20;
const MAX_HATCH_AMOUNT_LEVEL = 3;
const MAX_LUCK_LEVEL = 40;
const MAX_EQUIP_UPGRADE_LEVEL = 2;

const clickSpeedDelays = [
    0.50,
    0.40,
    0.30,
    0.20,
    0.10,
    0.05
];

const MAX_CLICK_SPEED = 5;

const rebirthUpgradeAmounts = [
    1,
    2,
    5,
    10,
    20,
    50,
    100,
    200,
    500,
    1000,
    2000,
    5000,
    10000,
    20000,
    50000,
    100000,
    200000,
    500000,
    1000000,
    2000000,
    5000000,
    10000000,
    20000000,
    50000000,
    100000000,
    200000000,
    500000000,
    1000000000,
    2000000000,
    5000000000
];
let clickPower = 1;
let selectedEgg = "Starter Egg";
let unlockedEggs = new Set(["Starter Egg"]);
let inventory = {};
let discovered = new Set();
let totalHatches = 0;
let totalClicks = 0;
let playTime = 0;
let hatchStreak = 0;
let bestHatchStreak = 0;
let mysteryBoxesOpened = 0;

let equippedPets = [];

let clickLocked = false;
let hatchLocked = false;

const CLICK_DELAY = 500;
const HATCH_DELAY = 500;

let MAX_EQUIPPED = 3;
function getMaxEquipped(){

    return 3 + equipUpgradeLevel;
}

function upgradeEquip(){

    if(equipUpgradeLevel >= MAX_EQUIP_UPGRADE_LEVEL){

        resultEl.textContent =
            "✅ Pet Equip is already maxed at 2/2!";

        showNotification(
            "🐾 Already Maxed!",
            "Pet Equip is already maxed at 2/2."
        );

        return;
    }

    const cost = 500;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    equipUpgradeLevel += 1;

    MAX_EQUIPPED =
        getMaxEquipped();

    resultEl.textContent =
        `🎉 Pet Equip upgraded! You can now equip ${MAX_EQUIPPED} pets.`;

    renderInventory();
    updateUI();
    save();
}

function upgradeAutoRebirth(){

    if(autoRebirthPurchased){

        resultEl.textContent =
            "✅ Auto-Rebirth is already purchased!";

        showNotification(
            "🔄 Already Purchased!",
            "Auto-Rebirth is already unlocked."
        );

        return;
    }

    const cost = 100;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    autoRebirthPurchased = true;

    // Default settings
    autoRebirthEnabled = false;
    autoRebirthTarget = 1;

    resultEl.textContent =
        "🎉 Auto-Rebirth purchased!";

    showNotification(
        "🔄 Auto-Rebirth Unlocked!",
        "You can now select your automatic rebirth target."
    );

    updateUI();
    save();
}

function autoRebirthCheck(){

    if(!autoRebirthPurchased){
        return;
    }

    if(!autoRebirthEnabled){
        return;
    }

    const amount = autoRebirthTarget;

    if(!amount || amount < 1){
        return;
    }

    let totalCost = 0;
    let tempCost = rebirthCost;

    for(let i = 0; i < amount; i++){

        if(
            tempCost >= Number.MAX_VALUE ||
            totalCost >= Number.MAX_VALUE - tempCost
        ){
            totalCost = Number.MAX_VALUE;
            break;
        }

        totalCost += tempCost;

        tempCost =
            Math.min(
                tempCost * 2.5,
                Number.MAX_VALUE
            );
    }

    if(coins >= totalCost){

        rebirthMultiple(amount);
    }
}

const basePetMultipliers = {
    "Cat": 1.15,
    "Pig": 1.5,
    "Koala": 2.0,
    "Lizard": 3.0,
    "Dragon": 6.0,
    "Phoenix": 10.0,
    "Hybrid": 17.5,

    "Robot": 2.5,
    "Cyber Cat": 3.0,
    "Neon Fox": 6.5,
    "Mecha Dragon": 10.0,
    "Quantum Phoenix": 15.0,
    "Galaxy Titan": 25.0,
    "Void Emperor": 60.0,
    "Prototype - A418": 1000000,

    "Naruto": 37.5,
    "Luffy": 45,
    "Denji": 97.5,
    "Gojo": 150,
    "Vegeta": 225,
    "Sun Jin Woo": 375,
    "MUI Goku": 900,
    "Shenron": 1500000,

    "Embryon": 1000,
    "Mystorius": 500
};

const mutationMultipliers = {
    "Shiny": 2.0,
    "Golden": 3.0,
    "Rainbow": 5.0,
    "Shiny Golden": 6.0,
    "Shiny Rainbow": 10.0,
    "Dark Matter": 15.0,
    "Shiny Dark Matter": 25.0,
    "Superior": 100.0,
    "Shiny Superior": 200.0,

    "Mystorius": 500.0,
    "Shiny Mystorius": 1000.0,
    "Golden Mystorius": 1500.0,
    "Rainbow Mystorius": 2500.0,
    "Dark Matter Mystorius": 7500.0,
    "Shiny Golden Mystorius": 3000.0,
    "Shiny Rainbow Mystorius": 5000.0,
    "Shiny Dark Matter Mystorius": 12500.0
};

const mutationNames = [
    "",
    "Shiny ",
    "Golden ",
    "Rainbow ",
    "Superior ",
    "Shiny Golden ",
    "Shiny Rainbow ",
    "Dark Matter ",
    "Shiny Dark Matter ",
    "Shiny Superior "
];

const eggs = {
    "Starter Egg": {
        emoji:"🥚", cost:100,
        pets:[
            ["Cat","🐱","Common",50.09],
            ["Pig","🐷","Uncommon",25],
            ["Koala","🐨","Epic",15],
            ["Lizard","🦎","Legendary",7],
            ["Dragon","🐉","Mythic",2],
            ["Phoenix","🔥","Ancient",0.8],
            ["Hybrid","✨","Celestial",0.1]
        ]
    },
    "Futuristic Egg": {
        emoji:"🚀", cost:50000,
        pets:[
            ["Robot","🤖","Common",50.09],
            ["Cyber Cat","🐱","Uncommon",25],
            ["Neon Fox","🦊","Epic",15],
            ["Mecha Dragon","🐲","Legendary",7],
            ["Quantum Phoenix","⚛️","Mythic",2],
            ["Galaxy Titan","🌌","Ancient",0.8],
            ["Void Emperor","👑","Celestial",0.1],
            ["Prototype - A418","🔬","Chromatic",0.01]
        ]
    },
    "Anime Egg": {
        emoji:"🥷", cost:25000000,
        pets:[
            ["Naruto","🍥","Common",50.09],
            ["Luffy","🏴‍☠️","Uncommon",25],
            ["Denji","🪚","Epic",15],
            ["Gojo","👁️","Legendary",7],
            ["Vegeta","⚡","Mythic",2],
            ["Sun Jin Woo","🖤","Ancient",0.8],
            ["MUI Goku","🌟","Celestial",0.1],
            ["Shenron","🐉","Chromatic",0.01]
        ]
    }
};

const coinsEl = document.getElementById("coins");
const gemsEl = document.getElementById("gems");
const resultEl = document.getElementById("selectedEggResult");

function formatCoins(n){

    const suffixes = [
        "",
        "k",
        "M",
        "B",
        "T",
        "Qa",
        "Qi",
        "Sx",
        "Sp",
        "Oc",
        "No",
        "Dc",
        "Ud",
        "Dd",
        "Td",
        "Qad",
        "Qid",
        "Sxd",
        "Spd",
        "Ocd",
        "Nod",
        "Vg",
        "Uvg",
        "Dvg",
        "Tvg",
        "Qavg",
        "Qivg",
        "Sxvg",
        "Spvg",
        "Ocvg",
        "Novg",
        "Tg",
        "Utg",
        "Dtg",
        "Ttg",
        "Qatg",
        "Qitg",
        "Sxtg",
        "Sptg",
        "Octg",
        "Notg",
        "Qag",
        "Uqag",
        "Dqag",
        "Tqag",
        "Qaqag",
        "Qiqag",
        "Sxqag",
        "Spqag",
        "Ocqag",
        "Noqag",
        "Qg",
        "Uqg",
        "Dqg",
        "Tqg",
        "Qaqg",
        "Qiqg",
        "Sxqg",
        "Spqg",
        "Ocqg",
        "Noqg",
        "Sg",
        "Usg",
        "Dsg",
        "Tsg",
        "Qasg",
        "Qisg",
        "Sxsg",
        "Spsg",
        "Ocsg",
        "Nosg",
        "Og",
        "Uog",
        "Dog",
        "Tog",
        "Qaog",
        "Qiog",
        "Sxog",
        "Spog",
        "Ocog",
        "Noog",
        "Ng",
        "Ung",
        "Dng",
        "Tng",
        "Qang",
        "Qing",
        "Sxng",
        "Spng",
        "Ocng",
        "Nong",
        "Ce",
        "Uce",
        "Dce",
        "Tce",
        "Qace",
        "Qice",
        "Sxce",
        "Spce",
        "Occe",
        "Noce"
    ];

    const generatedParts = [
        "A","B","C","D","E","F","G","H","I","J",
        "K","L","N","O","P","R","S","U","V","W",
        "X","Y","Z"
    ];

    while(suffixes.length < 1000){

        let number =
            suffixes.length - 100;

        let suffix = "";

        do{

            suffix =
                generatedParts[
                    number % generatedParts.length
                ] + suffix;

            number =
                Math.floor(
                    number / generatedParts.length
                ) - 1;

        }while(number >= 0);

        suffixes.push(suffix + "g");
    }

    let value = Number(n);
    let i = 0;

    if(!Number.isFinite(value)){
        return "∞";
    }

    while(
        value >= 1000 &&
        i < suffixes.length - 1
    ){

        value /= 1000;
        i++;

    }

    if(i === 0){

        return Math.floor(value)
            .toLocaleString();

    }

    if(value >= 100){

        return value.toFixed(0) + suffixes[i];

    }

    if(value >= 10){

        return value.toFixed(1) + suffixes[i];

    }

    return value.toFixed(2) + suffixes[i];
}

function renderClickSkins(){

    const grid =
        document.getElementById("clickSkinGrid");

    const equipped =
        document.getElementById("equippedClickSkin");

    if(!grid || !equipped) return;

    grid.innerHTML = "";

    equipped.textContent =
        equippedClickSkin;

    for(const skinName in clickSkins){

        const skin =
            clickSkins[skinName];

        const owned =
            ownedClickSkins.has(skinName);

        const isEquipped =
            equippedClickSkin === skinName;

        const card =
            document.createElement("div");

        card.className =
            "skin-card" +
            (owned ? " owned" : "") +
            (isEquipped ? " equipped" : "");

        let costText = "";

        if(skinName === "Classic"){
            costText = "OWNED";
        }else if(skinName === "Mystery"){
            costText = "Mystery";
        }else if(skinName === "Embryon"){
            costText = "Embryon";
        }else{
            costText =
                formatCoins(skin.cost) + " Coins";
        }

        card.innerHTML = `
            <span class="skin-icon">
                ${skin.emoji}
            </span>

            <strong>${skinName}</strong>

            <small>
                ×${skin.multiplier}
            </small>

            <small>
                ${isEquipped ? "EQUIPPED" : costText}
            </small>

            <button type="button">
                ${isEquipped
                    ? "EQUIPPED"
                    : owned
                        ? "EQUIP"
                        : "BUY"}
            </button>
        `;

        const button =
            card.querySelector("button");

        button.addEventListener("click", function(){

            if(isEquipped){

                showNotification(
                    "🎨 Already Equipped!",
                    `${skinName} Click Skin is already equipped.`
                );

                return;
            }

            if(!owned){

                if(
                    skinName === "Mystery" ||
                    skinName === "Embryon"
                ){

                    resultEl.textContent =
                        `🔒 ${skinName} Click Skin is not unlocked yet!`;

                    return;
                }

                if(coins < skin.cost){

                    resultEl.textContent =
                        "❌ You don't have enough coins!";

                    return;
                }

                coins -= skin.cost;

                ownedClickSkins.add(skinName);

                resultEl.textContent =
                    `🎨 ${skinName} Click Skin unlocked!`;
            }

            equippedClickSkin =
                skinName;

            resultEl.textContent =
                `🎨 ${skinName} Click Skin equipped!`;

            updateUI();
            renderClickSkins();
            save();
        });

        grid.appendChild(card);
    }
}

function craftMachine(machineType){

    const requiredPets = 6;
    let crafted = 0;

    for(const pet in inventory){

        const amount = inventory[pet] || 0;

        if(amount < requiredPets){
            continue;
        }

        let newPet = null;

        if(machineType === "Golden"){

            if(
                basePetMultipliers[pet] &&
                !pet.startsWith("Golden ")
            ){
                newPet = "Golden " + pet;
            }

            else if(pet.startsWith("Shiny ") &&
                    basePetMultipliers[pet.slice(6)]){
                newPet = "Shiny Golden " + pet.slice(6);
            }
        }

        else if(machineType === "Rainbow"){

            if(pet.startsWith("Golden ") &&
               basePetMultipliers[pet.slice(7)]){
                newPet = "Rainbow " + pet.slice(7);
            }

            else if(pet.startsWith("Shiny Golden ") &&
                    basePetMultipliers[pet.slice(13)]){
                newPet = "Shiny Rainbow " + pet.slice(13);
            }
        }

        else if(machineType === "Dark Matter"){

            if(pet.startsWith("Rainbow ") &&
               basePetMultipliers[pet.slice(8)]){
                newPet = "Dark Matter " + pet.slice(8);
            }

            else if(pet.startsWith("Shiny Rainbow ") &&
                    basePetMultipliers[pet.slice(14)]){
                newPet = "Shiny Dark Matter " + pet.slice(14);
            }
        }

        else if(machineType === "Superior"){

            if(pet.startsWith("Dark Matter ") &&
               basePetMultipliers[pet.slice(12)]){
                newPet = "Superior " + pet.slice(12);
            }

            else if(pet.startsWith("Shiny Dark Matter ") &&
                    basePetMultipliers[pet.slice(18)]){
                newPet = "Shiny Superior " + pet.slice(18);
            }
        }

        if(!newPet){
            continue;
        }

        inventory[pet] -= requiredPets;

        if(inventory[pet] <= 0){
            delete inventory[pet];
        }

        inventory[newPet] =
            (inventory[newPet] || 0) + 1;

        discovered.add(newPet);

        machineCrafts++;
        crafted++;

        if(machineType === "Golden"){
            goldenCrafts++;
        }

        else if(machineType === "Rainbow"){
            rainbowCrafts++;
        }

        else if(machineType === "Dark Matter"){
            darkMatterCrafts++;
        }

        else if(machineType === "Superior"){
            superiorCrafts++;
        }

        break;
    }

    if(crafted === 0){

        resultEl.textContent =
            `❌ You don't have enough valid pets for the ${machineType} Machine!`;

        if(crafted === 0){

        resultEl.textContent =
            `❌ You don't have enough valid pets for the ${machineType} Machine!`;

        showNotification(
            "❌ Not Enough Pets!",
            `You need 6 valid pets for the ${machineType} Machine.`
        );

        return;
    }

        return;
    }

    resultEl.textContent =
        `⚙️ ${machineType} Machine crafted 1 pet!`;

    showNotification(
        "⚙️ Machine Crafted!",
        `${machineType} Machine created 1 pet!`
    );

    renderInventory();
    renderIndex();
    updateUI();
    checkAchievements();
    save();
}

function craftAllMachines(){

    let totalCrafted = 0;

    while(true){

        let craftedThisRound = false;

        for(const machineType of [
            "Golden",
            "Rainbow",
            "Dark Matter",
            "Superior"
        ]){

            for(const pet in inventory){

                const amount =
                    inventory[pet] || 0;

                if(amount < 6){
                    continue;
                }

                let newPet = null;

                if(machineType === "Golden"){

                    if(
                        basePetMultipliers[pet] &&
                        !pet.startsWith("Golden ")
                    ){
                        newPet = "Golden " + pet;
                    }

                    else if(
                        pet.startsWith("Shiny ") &&
                        basePetMultipliers[pet.slice(6)]
                    ){
                        newPet =
                            "Shiny Golden " +
                            pet.slice(6);
                    }
                }

                else if(machineType === "Rainbow"){

                    if(
                        pet.startsWith("Golden ") &&
                        basePetMultipliers[pet.slice(7)]
                    ){
                        newPet =
                            "Rainbow " +
                            pet.slice(7);
                    }

                    else if(
                        pet.startsWith("Shiny Golden ") &&
                        basePetMultipliers[pet.slice(13)]
                    ){
                        newPet =
                            "Shiny Rainbow " +
                            pet.slice(13);
                    }
                }

                else if(machineType === "Dark Matter"){

                    if(
                        pet.startsWith("Rainbow ") &&
                        basePetMultipliers[pet.slice(8)]
                    ){
                        newPet =
                            "Dark Matter " +
                            pet.slice(8);
                    }

                    else if(
                        pet.startsWith("Shiny Rainbow ") &&
                        basePetMultipliers[pet.slice(14)]
                    ){
                        newPet =
                            "Shiny Dark Matter " +
                            pet.slice(14);
                    }
                }

                else if(machineType === "Superior"){

                    if(
                        pet.startsWith("Dark Matter ") &&
                        basePetMultipliers[pet.slice(12)]
                    ){
                        newPet =
                            "Superior " +
                            pet.slice(12);
                    }

                    else if(
                        pet.startsWith("Shiny Dark Matter ") &&
                        basePetMultipliers[pet.slice(18)]
                    ){
                        newPet =
                            "Shiny Superior " +
                            pet.slice(18);
                    }
                }

                if(!newPet){
                    continue;
                }

                inventory[pet] -= 6;

                if(inventory[pet] <= 0){
                    delete inventory[pet];
                }

                inventory[newPet] =
                    (inventory[newPet] || 0) + 1;

                discovered.add(newPet);

                machineCrafts++;
                totalCrafted++;
                craftedThisRound = true;

                if(machineType === "Golden"){
                    goldenCrafts++;
                }

                else if(machineType === "Rainbow"){
                    rainbowCrafts++;
                }

                else if(machineType === "Dark Matter"){
                    darkMatterCrafts++;
                }

                else if(machineType === "Superior"){
                    superiorCrafts++;
                }

                break;
            }
        }

        if(!craftedThisRound){
            break;
        }
    }

    if(totalCrafted === 0){

        resultEl.textContent =
            "❌ You don't have enough pets to craft anything!";

        if(totalCrafted === 0){

        resultEl.textContent =
            "❌ You don't have enough pets to craft anything!";

        showNotification(
            "❌ Not Enough Pets!",
            "You don't have enough duplicate pets to craft anything."
        );

        return;
    }

        return;
    }

    resultEl.textContent =
        `⚙️ Craft All created ${totalCrafted} pet${totalCrafted === 1 ? "" : "s"}!`;

    showNotification(
        "⚙️ Craft All!",
        `Created ${totalCrafted} pet${totalCrafted === 1 ? "" : "s"}!`
    );

    renderInventory();
    renderIndex();
    updateUI();
    checkAchievements();
    save();
}

function updateUI(){

    const autoRebirthStatusEl =
    document.getElementById("autoRebirthStatus");

    const autoRebirthTargetEl =
        document.getElementById("autoRebirthTarget");

    const autoRebirthUpgradeEl =
        document.getElementById("autoRebirthUpgrade");

    const autoRebirthControlsEl =
        document.getElementById("autoRebirthControls");

    const toggleAutoRebirthButton =
        document.getElementById("toggleAutoRebirthButton");


    if(autoRebirthPurchased){

        autoRebirthStatusEl.textContent =
            "PURCHASED";

        autoRebirthTargetEl.textContent =
            `Rebirth ×${autoRebirthTarget}`;

        autoRebirthUpgradeEl.style.display =
            "none";

        autoRebirthControlsEl.style.display =
            "block";

        toggleAutoRebirthButton.textContent =
            autoRebirthEnabled
                ? "🟢 AUTO REBIRTH: ON"
                : "🔴 AUTO REBIRTH: OFF";

        toggleAutoRebirthButton.classList.toggle(
            "active",
            autoRebirthEnabled
        );

    }else{

        autoRebirthStatusEl.textContent =
            "NOT PURCHASED";

        autoRebirthUpgradeEl.style.display =
            "block";

        autoRebirthControlsEl.style.display =
            "none";
    }

    document.getElementById("shopClickMultiplier").textContent =
    shopClickMultiplier + "x";

    if(shopClickMultiplier >= MAX_SHOP_CLICK_MULTIPLIER){

        document.getElementById("shopClickMultiplierNext").textContent =
            "MAX";

    }else{

        document.getElementById("shopClickMultiplierNext").textContent =
            (shopClickMultiplier + 1) + "x";

    }

    document.getElementById("shopClickMultiplierCost").textContent =
        "💰 " + formatCoins(shopClickMultiplierCost) + " Coins";

    document.getElementById("clickBoostCost").textContent =
    "💰 " + formatCoins(clickBoostCost) + " Coins";

    document.getElementById("mysteryBoxCost").textContent =
        "💰 " + formatCoins(mysteryBoxCost) + " Coins";

    document.getElementById("luckyBoostCost").textContent =
        "💰 " + formatCoins(luckyBoostCost) + " Coins";

    const clickBoostStatus =
    document.getElementById("clickBoostStatus");

if(clickBoostActive){

    const secondsLeft =
        Math.max(
            0,
            Math.ceil(
                (clickBoostEndTime - Date.now()) / 1000
            )
        );

    clickBoostStatus.textContent =
        `⚡ ACTIVE · ${secondsLeft}s remaining`;

}else{

    clickBoostStatus.textContent = "";

}


const luckyBoostStatus =
    document.getElementById("luckyBoostStatus");

if(luckyBoostActive){

    const secondsLeft =
        Math.max(
            0,
            Math.ceil(
                (luckyBoostEndTime - Date.now()) / 1000
            )
        );

    luckyBoostStatus.textContent =
        `🍀 ACTIVE · ${secondsLeft}s remaining`;

}else{

    luckyBoostStatus.textContent = "";

}

    clickPower = Math.pow(2, rebirths);
    coinsEl.textContent=formatCoins(coins);
    gemsEl.textContent=formatCoins(gems);
    document.getElementById("selectedEggName").textContent=eggs[selectedEgg].emoji+" "+selectedEgg;
    document.getElementById("selectedEggCost").textContent="Cost: "+formatCoins(eggs[selectedEgg].cost)+" 💰";
    document.getElementById("rebirthCoins").textContent = formatCoins(coins);
    document.getElementById("rebirthGems").textContent = formatCoins(gems);
    document.getElementById("rebirthCount").textContent = rebirths;
    document.getElementById("rebirthClickPower").textContent = formatCoins(clickPower) + "x";
    if(selectedRebirthAmount === 1){

    document.getElementById("rebirthCost").textContent =
        formatCoins(rebirthCost);

}else{

    let totalCost = 0;
    let tempCost = rebirthCost;

    for(let i = 0; i < selectedRebirthAmount; i++){

        totalCost += tempCost;

        tempCost =
            Math.floor(tempCost * 2.5);
    }

    document.getElementById("rebirthCost").textContent =
        formatCoins(totalCost);
}
    updateUpgradeUI();
}

async function save(){

    const gameData = {
        saveVersion: 1,
        coins,
        gems,
        autoRebirthPurchased: autoRebirthPurchased,
        autoRebirthEnabled: autoRebirthEnabled,
        autoRebirthTarget: autoRebirthTarget,
        clickPower,
        rebirths,
        rebirthCost,
        playTime,
        rebirthUpgradeLevel,
        clickSpeedLevel,
        multiplierLevel,
        hatchAmountLevel,
        luckLevel,
        equipUpgradeLevel,
        clickBoostCost,
        mysteryBoxCost,
        luckyBoostCost,
        clickBoostActive,
        clickBoostEndTime,
        luckyBoostActive,
        luckyBoostEndTime,
        shopClickMultiplier,
        shopClickMultiplierCost,
        selectedEgg,
        unlockedEggs:[...unlockedEggs],
        inventory,
        discovered:[...discovered],
        equippedPets,

        totalHatches,
        hatchStreak,
        bestHatchStreak,
        unlockedAchievements:[...unlockedAchievements],
        ownedClickSkins:[...ownedClickSkins],
        equippedClickSkin,
        shopPurchases,
        mysteryBoxesOpened
    };

    localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(gameData)
    );

    if(currentUser && accountResetVersion === 0){

        const {
            error
        } = await supabaseClient
            .from("player_data")
            .upsert({
                user_id: currentUser.id,
                game_data: gameData,
                reset_version: 0,
                updated_at: new Date().toISOString()
            });

        if(error){
            console.error(
                "Online save error:",
                error
            );
        }
    }

    saveLeaderboardStats();
}

async function load(){

    let raw =
        localStorage.getItem(SAVE_KEY);

    if(currentUser){

        const {
            data,
            error
        } = await supabaseClient
            .from("player_data")
            .select("game_data, reset_version")
            .eq("user_id", currentUser.id)
            .maybeSingle();

        if(error){

            console.error(
                "Online load error:",
                error
            );

        }else if(data){

            accountResetVersion = data.reset_version ?? 0;

            if(accountResetVersion > 0){

                raw = null;

                localStorage.removeItem(
                    SAVE_KEY
                );

                accountResetVersion = 0;

                await supabaseClient
                    .from("player_data")
                    .update({
                        game_data: {},
                        reset_version: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq(
                        "user_id",
                        currentUser.id
                    );

            }else{

                raw =
                    JSON.stringify(data.game_data);

                localStorage.setItem(
                    SAVE_KEY,
                    raw
                );

            }
        }
    }

    if(!raw) return;

    try{

        const d =
            JSON.parse(raw);

        coins=d.coins ?? coins;
        gems=d.gems ?? gems;
        playTime=d.playTime ?? playTime;
        clickPower=d.clickPower ?? clickPower;
        rebirths=d.rebirths ?? rebirths;
        rebirthCost=d.rebirthCost ?? rebirthCost;

        rebirthUpgradeLevel =
            Math.min(
                d.rebirthUpgradeLevel ?? rebirthUpgradeLevel,
                MAX_REBIRTH_UPGRADE
            );

        clickSpeedLevel =
            d.clickSpeedLevel ?? clickSpeedLevel;

        multiplierLevel =
            d.multiplierLevel ?? multiplierLevel;

        hatchAmountLevel =
            d.hatchAmountLevel ?? hatchAmountLevel;

        luckLevel =
            d.luckLevel ?? luckLevel;

        equipUpgradeLevel =
            d.equipUpgradeLevel ?? equipUpgradeLevel;

        autoRebirthPurchased =
            d.autoRebirthPurchased ?? autoRebirthPurchased;

        autoRebirthEnabled =
            d.autoRebirthEnabled ?? autoRebirthEnabled;

        autoRebirthTarget =
            d.autoRebirthTarget ?? autoRebirthTarget;

        clickBoostCost =
            d.clickBoostCost ?? clickBoostCost;

        clickBoostActive =
            d.clickBoostActive ?? false;

        clickBoostEndTime =
            d.clickBoostEndTime ?? 0;

        luckyBoostActive =
            d.luckyBoostActive ?? false;

        luckyBoostEndTime =
            d.luckyBoostEndTime ?? 0;

        mysteryBoxCost =
            d.mysteryBoxCost ?? mysteryBoxCost;

        luckyBoostCost =
            d.luckyBoostCost ?? luckyBoostCost;

        shopClickMultiplier =
            d.shopClickMultiplier ?? shopClickMultiplier;

        shopClickMultiplierCost =
            d.shopClickMultiplierCost ?? shopClickMultiplierCost;

        selectedEgg =
            d.selectedEgg ?? selectedEgg;

        unlockedEggs =
            new Set(
                d.unlockedEggs ?? ["Starter Egg"]
            );

        unlockedEggs.add("Starter Egg");

        inventory =
            d.inventory ?? {};

        discovered =
            new Set(d.discovered ?? []);

        totalHatches =
            d.totalHatches ?? 0;

        hatchStreak =
            d.hatchStreak ?? 0;

        bestHatchStreak =
            d.bestHatchStreak ?? 0;

        unlockedAchievements =
            new Set(
                d.unlockedAchievements ?? []
            );

        ownedClickSkins =
            new Set(
                d.ownedClickSkins ?? ["Classic"]
            );

        ownedClickSkins.add("Classic");

        equippedClickSkin =
            d.equippedClickSkin ?? "Classic";

        if(
            !ownedClickSkins.has(
                equippedClickSkin
            )
        ){

            equippedClickSkin =
                "Classic";
        }

        shopPurchases =
            d.shopPurchases ?? 0;

        mysteryBoxesOpened =
            d.mysteryBoxesOpened ?? 0;

        equippedPets =
            Array.isArray(d.equippedPets)
                ? d.equippedPets
                : [];

        equippedPets =
            equippedPets
                .filter(
                    pet =>
                        inventory[pet] !== undefined
                )
                .slice(
                    0,
                    getMaxEquipped()
                );

        if(
            !eggs[selectedEgg] ||
            !unlockedEggs.has(selectedEgg)
        ){

            selectedEgg =
                "Starter Egg";
        }

        if(
            clickBoostActive &&
            Date.now() >= clickBoostEndTime
        ){

            clickBoostActive = false;
            clickBoostEndTime = 0;
        }

        if(
            luckyBoostActive &&
            Date.now() >= luckyBoostEndTime
        ){

            luckyBoostActive = false;
            luckyBoostEndTime = 0;
        }

    }catch(e){

        console.error(
            "Save load error:",
            e
        );
    }
}

function renderEggs(){
    const grid=document.getElementById("eggGrid");

    grid.innerHTML=Object.entries(eggs).map(([name,data])=>{
        const locked=!unlockedEggs.has(name);
        const selected=name===selectedEgg;
        const status=locked
            ? `🔒 UNLOCK · ${formatCoins(data.cost)} 💰`
            : (selected ? "✅ SELECTED" : "SELECT");

        return `<button class="egg-option ${selected?"selected":""} ${locked?"locked":""}" data-egg="${name}">
            <div class="egg-icon">${data.emoji}</div>
            <h3>${name}</h3>
            <p>💰 ${formatCoins(data.cost)}</p>
            <span class="egg-status">${status}</span>
        </button>`;
    }).join("");

    grid.querySelectorAll(".egg-option").forEach(btn=>{
        btn.addEventListener("click",()=>chooseEgg(btn.dataset.egg));
    });
}

function chooseEgg(name){
    if(unlockedEggs.has(name)){
        selectedEgg=name;
        resultEl.textContent=`${eggs[name].emoji} ${name} selected!`;
    }else{
        const cost=eggs[name].cost;
        if(coins<cost){
            resultEl.textContent=`❌ You need ${formatCoins(cost-coins)} more coins!`;
            return;
        }
        coins-=cost;
        unlockedEggs.add(name);
        selectedEgg=name;
        resultEl.textContent=`🎉 ${name} unlocked and selected!`;
    }
    renderEggs();
    updateUI();
    save();
}

function pickPet(egg){

    const pets =
        eggs[egg].pets;

    let luckMultiplier =
        1 + (luckLevel * 0.1);

    if(luckyBoostActive){

        if(Date.now() < luckyBoostEndTime){

            luckMultiplier += 5;

        }else{

            luckyBoostActive = false;
            luckyBoostEndTime = 0;

        }
    }

    let totalWeight = 0;

    for(let i = 0; i < pets.length; i++){

        const rarityWeight =
            1 + (i / (pets.length - 1)) * (luckMultiplier - 1);

        totalWeight +=
            pets[i][3] * rarityWeight;
    }

    let roll =
        Math.random() * totalWeight;

    for(let i = 0; i < pets.length; i++){

        const rarityWeight =
            1 + (i / (pets.length - 1)) * (luckMultiplier - 1);

        roll -=
            pets[i][3] * rarityWeight;

        if(roll < 0){

            return pets[i];

        }
    }

    return pets[0];
}

function applyMutation(baseName){
    const shiny=Math.floor(Math.random()*100)+1;
    const golden=Math.floor(Math.random()*100)+1;
    const rainbow=Math.floor(Math.random()*100)+1;
    const dark=Math.floor(Math.random()*100)+1;

    if(dark===1 && shiny<=5) return "Shiny Dark Matter "+baseName;
    if(dark===1) return "Dark Matter "+baseName;
    if(shiny<=5 && golden<=25) return "Shiny Golden "+baseName;
    if(shiny<=5 && rainbow<=10) return "Shiny Rainbow "+baseName;
    if(shiny<=5) return "Shiny "+baseName;
    if(golden<=25) return "Golden "+baseName;
    if(rainbow<=10) return "Rainbow "+baseName;
    return baseName;
}

function getPetMultiplier(name){

    let cleanName = name;
    let mutation = "";

    const prefixes = [
        "Shiny Dark Matter ",
        "Shiny Superior ",
        "Shiny Golden ",
        "Shiny Rainbow ",
        "Dark Matter ",
        "Shiny ",
        "Golden ",
        "Rainbow ",
        "Superior "
    ];

    for(const prefix of prefixes){

        if(cleanName.startsWith(prefix)){

            mutation = prefix.trim();

            cleanName = cleanName.slice(prefix.length);

            break;
        }
    }

    const baseMultiplier = basePetMultipliers[cleanName] ?? 1;

    const mutationMultiplier = mutationMultipliers[mutation] ?? 1;

    return baseMultiplier * mutationMultiplier;
}

function findPetData(name){
    for(const egg of Object.values(eggs)){
        for(const p of egg.pets){
            if(p[0]===name) return p;
        }
    }
    return null;
}

function hatch(){

    if(hatchLocked){
        return;
    }


    const cost =
        eggs[selectedEgg].cost;


    const hatchAmount =
        hatchAmountLevel + 1;

    if(coins < cost * hatchAmount){

        resultEl.textContent =
            "❌ Not enough coins!";

        return;
    }


    hatchLocked = true;


    const hatchButton =
        document.getElementById("hatchButton");

    hatchButton.disabled = true;

    coins -= cost * hatchAmount;

    let hatchedNames = [];

    for(let i = 0; i < hatchAmount; i++){

        const base =
            pickPet(selectedEgg);

        const petName =
            applyMutation(base[0]);

        const rarity =
            base[2];

        if(rarity === "Uncommon"){
            unlockAchievement("Hatch an Uncommon Pet");
        }

        if(rarity === "Epic"){
            unlockAchievement("Hatch an Epic Pet");
        }

        if(rarity === "Legendary"){
            unlockAchievement("Hatch a Legendary Pet");
        }

        if(rarity === "Mythic"){
            unlockAchievement("Hatch a Mythic Pet");
        }

        if(rarity === "Ancient"){
            unlockAchievement("Hatch an Ancient Pet");
        }

        if(rarity === "Celestial"){
            unlockAchievement("Hatch a Celestial Pet");
        }

        if(petName.startsWith("Shiny ")){
            unlockAchievement("Hatch a Shiny Pet");
        }

        if(petName.startsWith("Golden ")){
            unlockAchievement("Hatch a Golden Pet");
        }

        if(petName.startsWith("Rainbow ")){
            unlockAchievement("Hatch a Rainbow Pet");
        }

        if(petName.startsWith("Shiny Golden ")){
            unlockAchievement("Hatch a Shiny Golden Pet");
        }

        if(petName.startsWith("Shiny Rainbow ")){
            unlockAchievement("Hatch a Shiny Rainbow Pet");
        }

        if(petName.startsWith("Dark Matter ")){
            unlockAchievement("Hatch a Dark Matter Pet");
        }

        if(petName.startsWith("Shiny Dark Matter ")){
            unlockAchievement("Hatch a Shiny Dark Matter Pet");
        }

        inventory[petName] = 
            (inventory[petName] || 0) + 1;

        totalHatches++;

        hatchStreak++;

        if(hatchStreak > bestHatchStreak){
            bestHatchStreak = hatchStreak;
        }

        discovered.add(petName);

        hatchedNames.push(
            `${base[1]} ${petName}`
        );
    }

    checkAchievements();

    function checkAchievements(){

        if(machineCrafts >= 1){
        unlockAchievement("First Machine Craft");
    }

    if(machineCrafts >= 10){
        unlockAchievement("Craft 10 Pets");
    }

    if(machineCrafts >= 100){
        unlockAchievement("Craft 100 Pets");
    }

    if(machineCrafts >= 1000){
        unlockAchievement("Craft 1,000 Pets");
    }

    if(goldenCrafts >= 1){
        unlockAchievement("Golden Crafter");
    }

    if(rainbowCrafts >= 1){
        unlockAchievement("Rainbow Crafter");
    }

    if(darkMatterCrafts >= 1){
        unlockAchievement("Dark Matter Crafter");
    }

    if(superiorCrafts >= 1){
        unlockAchievement("Superior Crafter");
    }

    if(
        goldenCrafts >= 1 &&
        rainbowCrafts >= 1 &&
        darkMatterCrafts >= 1 &&
        superiorCrafts >= 1
    ){
        unlockAchievement("Craft All");
    }

    // ==========================================
    // 🥚 HATCHING
    // ==========================================

    if(totalHatches >= 1){
        unlockAchievement("First Hatch");
    }

    if(totalHatches >= 10){
        unlockAchievement("Hatch 10 Eggs");
    }

    if(totalHatches >= 100){
        unlockAchievement("Hatch 100 Eggs");
    }

    if(totalHatches >= 1000){
        unlockAchievement("Hatch 1,000 Eggs");
    }

    if(totalHatches >= 10000){
        unlockAchievement("Hatch 10,000 Eggs");
    }

    if(totalHatches >= 100000){
        unlockAchievement("Hatch 100,000 Eggs");
    }

    if(totalHatches >= 1000000){
        unlockAchievement("Hatch 1,000,000 Eggs");
    }

    if(totalHatches >= 10000000){
        unlockAchievement("Hatch 10,000,000 Eggs");
    }


    // ==========================================
    // 📖 COLLECTION
    // ==========================================

    const discoveredCount = discovered.size;

    if(discoveredCount >= 10){
        unlockAchievement("Discover 10 Pets");
    }

    if(discoveredCount >= 25){
        unlockAchievement("Discover 25 Pets");
    }

    if(discoveredCount >= 50){
        unlockAchievement("Discover 50 Pets");
    }

    if(discoveredCount >= 100){
        unlockAchievement("Discover 100 Pets");
    }

    if(discoveredCount >= 150){
        unlockAchievement("Discover 150 Pets");
    }


    // ==========================================
    // 🥚 STARTER EGG
    // ==========================================

    const starterPets = [
        "Cat",
        "Pig",
        "Koala",
        "Lizard",
        "Dragon",
        "Phoenix",
        "Hybrid"
    ];

    if(
        starterPets.every(
            pet => discovered.has(pet)
        )
    ){
        unlockAchievement(
            "Hatch Every Starter Egg Pet"
        );
    }


    // ==========================================
    // 🤖 FUTURISTIC PETS
    // ==========================================

    const futuristicPets = [
        "Robot",
        "Cyber Cat",
        "Neon Fox",
        "Mecha Dragon",
        "Quantum Phoenix",
        "Galaxy Titan",
        "Void Emperor",
        "Prototype - A418"
    ];

    for(const pet of futuristicPets){

        if(discovered.has(pet)){
            unlockAchievement(
                pet === "Prototype - A418"
                    ? "Hatch Prototype"
                    : `Hatch ${pet}`
            );
        }
    }


    // ==========================================
    // 🥷 ANIME PETS
    // ==========================================

    const animePets = [
        "Naruto",
        "Luffy",
        "Denji",
        "Gojo",
        "Vegeta",
        "Sun Jin Woo",
        "MUI Goku",
        "Shenron"
    ];

    for(const pet of animePets){

        if(discovered.has(pet)){
            unlockAchievement(
                `Obtain ${pet}`
            );
        }
    }

    // INDIVIDUAL PET ACHIEVEMENTS

    const petAchievementMap = {

        "Robot": "Hatch Robot",
        "Cyber Cat": "Hatch Cyber Cat",
        "Neon Fox": "Hatch Neon Fox",
        "Mecha Dragon": "Hatch Mecha Dragon",
        "Quantum Phoenix": "Hatch Quantum Phoenix",
        "Galaxy Titan": "Hatch Galaxy Titan",
        "Void Emperor": "Hatch Void Emperor",
        "Prototype - A418": "Hatch Prototype",

        "Naruto": "Obtain Naruto",
        "Luffy": "Obtain Luffy",
        "Denji": "Obtain Denji",
        "Gojo": "Obtain Gojo",
        "Vegeta": "Obtain Vegeta",
        "Sun Jin Woo": "Obtain Sun Jin Woo",
        "MUI Goku": "Obtain MUI Goku",
        "Shenron": "Obtain Shenron"

    };

    for(const pet in petAchievementMap){

        if(discovered.has(pet)){

            unlockAchievement(
                petAchievementMap[pet]
            );

        }

    }


    // ==========================================
    // ✨ VARIANTS
    // ==========================================

    for(const pet of discovered){

        if(pet.includes("Shiny ")){
            unlockAchievement("Hatch a Shiny Pet");
        }

        if(pet.includes("Golden ")){
            unlockAchievement("Hatch a Golden Pet");
        }

        if(pet.includes("Rainbow ")){
            unlockAchievement("Hatch a Rainbow Pet");
        }

        if(pet.includes("Shiny Golden ")){
            unlockAchievement(
                "Hatch a Shiny Golden Pet"
            );
        }

        if(pet.includes("Shiny Rainbow ")){
            unlockAchievement(
                "Hatch a Shiny Rainbow Pet"
            );
        }

        if(pet.includes("Dark Matter ")){
            unlockAchievement(
                "Hatch a Dark Matter Pet"
            );
        }

        if(pet.includes("Shiny Dark Matter ")){
            unlockAchievement(
                "Hatch a Shiny Dark Matter Pet"
            );
        }

        if(pet.includes("Superior ")){
            unlockAchievement(
                "Obtain a Superior Pet"
            );

            if(pet.includes("Shiny Superior ")){
                unlockAchievement(
                    "Obtain a Shiny Superior Pet"
                );
            }
        }
    }

    // PET OWNERSHIP

    const totalPets =
        Object.values(inventory).reduce(
            (total, amount) => total + amount,
            0
        );

    if(totalPets >= 10){
        unlockAchievement("Own 10 Pets");
    }

    if(totalPets >= 50){
        unlockAchievement("Own 50 Pets");
    }

    if(totalPets >= 100){
        unlockAchievement("Own 100 Pets");
    }

    if(totalPets >= 500){
        unlockAchievement("Own 500 Pets");
    }

    if(totalPets >= 1000){
        unlockAchievement("Own 1,000 Pets");
    }

    if(totalPets >= 5000){
        unlockAchievement("Own 5,000 Pets");
    }

    if(totalPets >= 10000){
        unlockAchievement("Own 10,000 Pets");
    }

    // ==========================================
    // ⚡ EQUIPMENT
    // ==========================================

    const equipped = equippedPets.length;

    if(equipped >= 1){
        unlockAchievement(
            "Equip Your First Pet"
        );
    }

    if(equipped >= 3){
        unlockAchievement("Equip 3 Pets");
    }

    if(equipped >= 4){
        unlockAchievement("Equip 4 Pets");
    }

    if(equipped >= 5){

        unlockAchievement("Equip 5 Pets");
        unlockAchievement("Full Team");
        unlockAchievement("Ultimate Team");
    }

    // EQUIPPED PETS

    const equippedCount =
        equippedPets.length;

    if(equippedCount >= 1){
        unlockAchievement("Equip Your First Pet");
    }

    if(equippedCount >= 3){
        unlockAchievement("Equip 3 Pets");
    }

    if(equippedCount >= 4){
        unlockAchievement("Equip 4 Pets");
    }

    if(equippedCount >= 5){

        unlockAchievement("Equip 5 Pets");
        unlockAchievement("Full Team");
        unlockAchievement("Ultimate Team");

    }

    // MYSTORIUS ACHIEVEMENTS

    const mystoriusAchievements = {
        "Mystorius": "Obtain Mystorius",
        "Shiny Mystorius": "Obtain Shiny Mystorius",
        "Golden Mystorius": "Obtain Golden Mystorius",
        "Rainbow Mystorius": "Obtain Rainbow Mystorius",
        "Dark Matter Mystorius": "Obtain Dark Matter Mystorius",
        "Shiny Golden Mystorius": "Obtain Shiny Golden Mystorius",
        "Shiny Rainbow Mystorius": "Obtain Shiny Rainbow Mystorius",
        "Shiny Dark Matter Mystorius": "Obtain Shiny Dark Matter Mystorius"
    };

    for(const pet in mystoriusAchievements){

        if(discovered.has(pet)){

            unlockAchievement(
                mystoriusAchievements[pet]
            );

        }

    }

    // MUTATION ACHIEVEMENTS

    for(const pet of discovered){

        if(pet.startsWith("Shiny ")){
            unlockAchievement("Hatch a Shiny Pet");
        }

        if(pet.startsWith("Golden ")){
            unlockAchievement("Hatch a Golden Pet");
        }

        if(pet.startsWith("Rainbow ")){
            unlockAchievement("Hatch a Rainbow Pet");
        }

        if(pet.startsWith("Shiny Golden ")){
            unlockAchievement("Hatch a Shiny Golden Pet");
        }

        if(pet.startsWith("Shiny Rainbow ")){
            unlockAchievement("Hatch a Shiny Rainbow Pet");
        }

        if(pet.startsWith("Dark Matter ")){
            unlockAchievement("Hatch a Dark Matter Pet");
        }

        if(pet.startsWith("Shiny Dark Matter ")){
            unlockAchievement("Hatch a Shiny Dark Matter Pet");
        }

    }

    // LUCK ACHIEVEMENTS

    if(luckLevel >= 1){
        unlockAchievement("Lucky Hatch");
    }

    if(luckLevel >= 10){
        unlockAchievement("Very Lucky");
    }

    if(luckLevel >= 25){
        unlockAchievement("Insanely Lucky");
    }

    if(luckLevel >= 35){
        unlockAchievement("Luck Master");
    }

    if(luckLevel >= MAX_LUCK_LEVEL){
        unlockAchievement("Maximum Luck");
    }

    // REBIRTH ACHIEVEMENTS

    if(rebirths >= 1){
        unlockAchievement("First Rebirth");
    }

    if(rebirths >= 10){
        unlockAchievement("10 Rebirths");
    }

    if(rebirths >= 50){
        unlockAchievement("50 Rebirths");
    }

    if(rebirths >= 100){
        unlockAchievement("100 Rebirths");
    }

    if(rebirths >= 500){
        unlockAchievement("500 Rebirths");
    }

    if(rebirths >= 1000){
        unlockAchievement("1,000 Rebirths");
    }

    if(rebirths >= 10000){
        unlockAchievement("10,000 Rebirths");
    }

    if(rebirths >= 10000){
        unlockAchievement("Rebirth Master");
    }

    // COIN ACHIEVEMENTS

    if(coins >= 1000){
        unlockAchievement("Earn 1,000 Coins");
    }

    if(coins >= 1000000){
        unlockAchievement("Earn 1,000,000 Coins");
    }

    if(coins >= 1000000000){
        unlockAchievement("Earn 1,000,000,000 Coins");
    }

    if(coins >= 1000000000000){
        unlockAchievement("Earn 1 Trillion Coins");
    }

    if(coins >= 1000000000000000){
        unlockAchievement("Earn 1 Quadrillion Coins");
    }

    // GEM ACHIEVEMENTS

    if(gems >= 100){
        unlockAchievement("Obtain 100 Gems");
    }

    if(gems >= 1000){
        unlockAchievement("Obtain 1,000 Gems");
    }

    if(gems >= 10000){
        unlockAchievement("Obtain 10,000 Gems");
        unlockAchievement("Gem Collector");
    }

    if(gems >= 100000){
        unlockAchievement("Obtain 100,000 Gems");
        unlockAchievement("Gem Hoarder");
    }

    // HATCH STREAK ACHIEVEMENTS

    if(hatchStreak >= 10){
        unlockAchievement("10 Hatch Streak");
    }

    if(hatchStreak >= 25){
        unlockAchievement("25 Hatch Streak");
    }

    if(hatchStreak >= 50){
        unlockAchievement("50 Hatch Streak");
    }

    if(hatchStreak >= 100){
        unlockAchievement("100 Hatch Streak");
    }

    if(hatchStreak >= 250){
        unlockAchievement("250 Hatch Streak");
    }

    if(hatchStreak >= 500){
        unlockAchievement("500 Hatch Streak");
    }

    if(hatchStreak >= 1000){
        unlockAchievement("1,000 Hatch Streak");
    }

    // FUTURISTIC EGG ACHIEVEMENTS

    if(unlockedEggs.has("Futuristic Egg")){
        unlockAchievement("Unlock Futuristic Egg");
    }

    let futuristicHatches = 0;

    for(const pet of futuristicPets){
        futuristicHatches += inventory[pet] || 0;
    }

    if(futuristicHatches >= 100){
        unlockAchievement("Hatch 100 Futuristic Pets");
    }

    if(futuristicHatches >= 1000){
        unlockAchievement("Hatch 1,000 Futuristic Pets");
    }

    if(
        futuristicPets.every(
            pet => discovered.has(pet)
        )
    ){
        unlockAchievement("Hatch Every Futuristic Egg Pet");
    }

    // STARTER EGG ACHIEVEMENT

    if(
        starterPets.every(
            pet => discovered.has(pet)
        )
    ){
        unlockAchievement("Hatch Every Starter Egg Pet");
    }

    // DISCOVERY ACHIEVEMENTS

    if(discoveredCount >= 10){
        unlockAchievement("Discover 10 Pets");
    }

    if(discoveredCount >= 25){
        unlockAchievement("Discover 25 Pets");
    }

    if(discoveredCount >= 50){
        unlockAchievement("Discover 50 Pets");
    }

    if(discoveredCount >= 100){
        unlockAchievement("Discover 100 Pets");
    }

    if(discoveredCount >= 150){
        unlockAchievement("Discover 150 Pets");
    }

    // RARITY ACHIEVEMENTS

    for(const pet of discovered){

        const basePet =
            pet
                .replace("Shiny Dark Matter ", "")
                .replace("Shiny Golden ", "")
                .replace("Shiny Rainbow ", "")
                .replace("Dark Matter ", "")
                .replace("Shiny ", "")
                .replace("Golden ", "")
                .replace("Rainbow ", "");

        for(const eggName in eggs){

            const eggPet =
                eggs[eggName].pets.find(
                    entry => entry[0] === basePet
                );

            if(!eggPet) continue;

            const rarity = eggPet[2];

            if(rarity === "Uncommon"){
                unlockAchievement("Hatch an Uncommon Pet");
            }

            if(rarity === "Epic"){
                unlockAchievement("Hatch an Epic Pet");
            }

            if(rarity === "Legendary"){
                unlockAchievement("Hatch a Legendary Pet");
            }

            if(rarity === "Mythic"){
                unlockAchievement("Hatch a Mythic Pet");
            }

            if(rarity === "Ancient"){
                unlockAchievement("Hatch an Ancient Pet");
            }

            if(rarity === "Celestial"){
                unlockAchievement("Hatch a Celestial Pet");
            }
        }
    }

    // ==========================================
    // 💰 COINS
    // ==========================================

    if(coins >= 1000){
        unlockAchievement("Earn 1,000 Coins");
    }

    if(coins >= 1000000){
        unlockAchievement("Earn 1,000,000 Coins");
    }

    if(coins >= 1000000000){
        unlockAchievement(
            "Earn 1,000,000,000 Coins"
        );
    }

    if(coins >= 1000000000000){
        unlockAchievement(
            "Earn 1 Trillion Coins"
        );
    }

    if(coins >= 1000000000000000){
        unlockAchievement(
            "Earn 1 Quadrillion Coins"
        );
    }


    // ==========================================
    // 💎 GEMS
    // ==========================================

    if(gems >= 100){
        unlockAchievement("Obtain 100 Gems");
    }

    if(gems >= 1000){
        unlockAchievement("Obtain 1,000 Gems");
    }

    if(gems >= 10000){
        unlockAchievement("Obtain 10,000 Gems");
        unlockAchievement("Gem Collector");
    }

    if(gems >= 100000){
        unlockAchievement(
            "Obtain 100,000 Gems"
        );

        unlockAchievement("Gem Hoarder");
    }


    // ==========================================
    // 🔄 REBIRTHS
    // ==========================================

    if(rebirths >= 1){
        unlockAchievement("First Rebirth");
    }

    if(rebirths >= 10){
        unlockAchievement("10 Rebirths");
    }

    if(rebirths >= 50){
        unlockAchievement("50 Rebirths");
    }

    if(rebirths >= 100){
        unlockAchievement("100 Rebirths");
    }

    if(rebirths >= 500){
        unlockAchievement("500 Rebirths");
    }

    if(rebirths >= 1000){
        unlockAchievement("1,000 Rebirths");
    }

    if(rebirths >= 10000){
        unlockAchievement("10,000 Rebirths");
        unlockAchievement("Rebirth Master");
    }


    // ==========================================
    // 🔥 HATCH STREAK
    // ==========================================

    if(hatchStreak >= 10){
        unlockAchievement("10 Hatch Streak");
    }

    if(hatchStreak >= 25){
        unlockAchievement("25 Hatch Streak");
    }

    if(hatchStreak >= 50){
        unlockAchievement("50 Hatch Streak");
    }

    if(hatchStreak >= 100){
        unlockAchievement("100 Hatch Streak");
    }

    if(hatchStreak >= 250){
        unlockAchievement("250 Hatch Streak");
    }

    if(hatchStreak >= 500){
        unlockAchievement("500 Hatch Streak");
    }

    if(hatchStreak >= 1000){
        unlockAchievement("1,000 Hatch Streak");
    }


    // ==========================================
    // 🛒 SHOP
    // ==========================================

    if(shopPurchases >= 1){
        unlockAchievement(
            "First Shop Purchase"
        );
    }

    if(shopPurchases >= 5){
        unlockAchievement("Buy 5 Shop Items");
    }

    if(shopPurchases >= 25){
        unlockAchievement("Buy 25 Shop Items");
    }

    if(shopPurchases >= 100){
        unlockAchievement("Buy 100 Shop Items");
    }

    if(shopClickMultiplier >= 2){
        unlockAchievement(
            "Reach 2x Shop Multiplier"
        );
    }

    if(shopClickMultiplier >= 5){
        unlockAchievement(
            "Reach 5x Shop Multiplier"
        );
    }

    if(shopClickMultiplier >= 10){
        unlockAchievement(
            "Reach 10x Shop Multiplier"
        );
    }

    if(shopClickMultiplier >= 10){
        unlockAchievement(
            "Reach 10x Click Multiplier"
        );
    }


    // ==========================================
    // 🎲 MYSTERY BOX
    // ==========================================

    if(mysteryBoxesOpened >= 1){
        unlockAchievement(
            "Open Your First Mystery Box"
        );
    }

    if(mysteryBoxesOpened >= 10){
        unlockAchievement(
            "Open 10 Mystery Boxes"
        );
    }

    if(mysteryBoxesOpened >= 100){
        unlockAchievement(
            "Open 100 Mystery Boxes"
        );

        unlockAchievement(
            "Mystery Box Master"
        );
    }

    if(mysteryBoxesOpened >= 1000){
        unlockAchievement(
            "Open 1,000 Mystery Boxes"
        );
    }
}

    resultEl.textContent =
        `🎉 You hatched ${hatchAmount} eggs! · ${hatchedNames.join(", ")}`;


    renderInventory();

    renderIndex();

    renderEggs();

    updateUI();

    save();


    setTimeout(() => {

    hatchLocked = false;
    hatchButton.disabled = false;

}, 500);

}

function upgradeLuck(){

    if(luckLevel >= MAX_LUCK_LEVEL){

        resultEl.textContent =
            "✅ Luck is already maxed at 40/40!";

        showNotification(
            "🍀 Already Maxed!",
            "Luck is already maxed at 40/40."
        );

        return;
    }

    const cost = 50;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    luckLevel += 1;

    resultEl.textContent =
        `🎉 Luck upgraded to ${luckLevel}/40! Current: ${(1 + luckLevel * 0.1).toFixed(1)}x`;

    updateUI();
    save();
}

function selectAutoRebirth(){

    if(!autoRebirthPurchased){

        showNotification(
            "🔒 Locked",
            "Purchase Auto-Rebirth first."
        );

        return;
    }

    const choices = [];

    for(
        let level = 1;
        level <= rebirthUpgradeLevel;
        level++
    ){

        const amount =
            rebirthUpgradeAmounts[level];

        if(amount !== undefined){
            choices.push(amount);
        }
    }

    if(choices.length === 0){

        showNotification(
            "🔒 No Targets",
            "Unlock a rebirth amount first."
        );

        return;
    }

    const choiceText = choices
        .map(
            value =>
                `${value}: Rebirth ×${formatRebirthAmount(value)}`
        )
        .join("\n");

    const selected = prompt(
        `Select Auto-Rebirth target:\n\n${choiceText}\n\nEnter a number:`
    );

    if(selected === null){
        return;
    }

    const target = Number(selected);

    if(!choices.includes(target)){

        showNotification(
            "❌ Invalid Target",
            "Please choose one of your unlocked rebirth amounts."
        );

        return;
    }

    autoRebirthTarget = target;

    updateUI();
    save();

    showNotification(
        "🎯 Target Selected!",
        `Auto-Rebirth target set to ×${formatRebirthAmount(target)}.`
    );
}


function toggleAutoRebirth(){

    if(!autoRebirthPurchased){

        showNotification(
            "🔒 Locked",
            "Purchase Auto-Rebirth first."
        );

        return;
    }

    autoRebirthEnabled =
        !autoRebirthEnabled;

    updateUI();
    save();

    showNotification(
        autoRebirthEnabled
            ? "🟢 Auto-Rebirth ON"
            : "🔴 Auto-Rebirth OFF",
        autoRebirthEnabled
            ? `Automatically rebirthing ×${autoRebirthTarget}.`
            : "Auto-Rebirth has been disabled."
    );
}

function rebirth(){
    rebirthMultiple(1);
}

function upgradeRebirths(){

    const result =
        document.getElementById("rebirthResult");

    if(rebirthUpgradeLevel >= MAX_REBIRTH_UPGRADE){

        result.textContent =
            "✅ More Rebirths is already maxed at 15/15!";

        showNotification(
            "🔄 Already Maxed!",
            "More Rebirths is already maxed at 15/15."
        );

        return;
    }

    const cost = 10;

    if(gems < cost){

        result.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    rebirthUpgradeLevel += 1;

    result.textContent =
        `🎉 More Rebirths upgraded to ${rebirthUpgradeLevel}/15! Rebirth ${formatRebirthAmount(rebirthUpgradeAmounts[rebirthUpgradeLevel])}`;

    updateUI();
    updateRebirthButtons();
    save();
}

function updateRebirthButtons(){

    const container =
        document.getElementById("rebirthButtons");

    container.innerHTML = "";

    for(let level = 1; level <= rebirthUpgradeLevel; level++){

        const amount =
            rebirthUpgradeAmounts[level];

        if(amount === undefined){
            continue;
        }

        const button =
            document.createElement("button");

        button.className = "hatch-button";

        button.textContent =
            `🔄 REBIRTH ×${formatRebirthAmount(amount)}`;

        button.addEventListener("click", () => {

            selectedRebirthAmount = amount;

            rebirthMultiple(amount);
        });

        container.appendChild(button);
    }
}

function formatRebirthAmount(amount){

    if(amount >= 1000000000){
        return (amount / 1000000000).toFixed(amount % 1000000000 === 0 ? 0 : 1) + "b";
    }

    if(amount >= 1000000){
        return (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "m";
    }

    if(amount >= 1000){
        return (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k";
    }

    return amount;
}

function rebirthMultiple(amount){

    selectedRebirthAmount = amount;

    let totalCost = 0;
    let tempCost = rebirthCost;

    for(let i = 0; i < amount; i++){

    if(
        tempCost >= Number.MAX_VALUE ||
        totalCost >= Number.MAX_VALUE - tempCost
    ){
        totalCost = Number.MAX_VALUE;
        break;
    }

    totalCost += tempCost;

    tempCost =
        Math.min(
            tempCost * 2.5,
            Number.MAX_VALUE
        );
}

    document.getElementById("rebirthCost").textContent =
        formatCoins(totalCost);

    if(coins < totalCost){

        document.getElementById("rebirthResult").textContent =
            `❌ You need ${formatCoins(totalCost - coins)} more coins!`;

        showNotification(
            "❌ Not Enough Coins!",
            "You don't have enough coins to rebirth."
        );

        return;
    }

    coins = 0;

    rebirths += amount;

    gems += 10 * amount;

    rebirthCost = tempCost;

    clickPower =
        Math.pow(2, rebirths);

    document.getElementById("rebirthResult").textContent =
        `🎉 REBIRTH ×${formatRebirthAmount(amount)}! +${formatCoins(amount * 10)} 💎 gems`;

    showNotification(
        "🔄 Rebirth!",
        `You rebirthed ×${formatRebirthAmount(amount)}!`
    );

    updateUI();

    let newTotalCost = 0;
    let newTempCost = rebirthCost;

    for(let i = 0; i < amount; i++){

        if(
            newTempCost >= Number.MAX_VALUE ||
            newTotalCost >= Number.MAX_VALUE - newTempCost
        ){
            newTotalCost = Number.MAX_VALUE;
            break;
        }

        newTotalCost += newTempCost;

        newTempCost =
            Math.min(
                newTempCost * 2.5,
                Number.MAX_VALUE
            );
    }

    document.getElementById("rebirthCost").textContent =
        formatCoins(newTotalCost);

    save();
}

function checkAutoRebirth(){

    if(!autoRebirthPurchased){
        return;
    }

    if(!autoRebirthEnabled){
        return;
    }

    const amount = autoRebirthTarget;

    if(!amount || amount < 1){
        return;
    }

    let totalCost = 0;
    let tempCost = rebirthCost;

    for(let i = 0; i < amount; i++){

        if(
            tempCost >= Number.MAX_VALUE ||
            totalCost >= Number.MAX_VALUE - tempCost
        ){
            totalCost = Number.MAX_VALUE;
            break;
        }

        totalCost += tempCost;

        tempCost =
            Math.min(
                tempCost * 2.5,
                Number.MAX_VALUE
            );
    }

    if(coins >= totalCost){

        rebirthMultiple(amount);
    }
}

function upgradeClickSpeed(){

    if(clickSpeedLevel >= MAX_CLICK_SPEED){

        resultEl.textContent =
            "✅ Click Speed is already maxed at 5/5!";

        showNotification(
            "⚡ Already Maxed!",
            "Click Speed is already maxed at 5/5."
        );

        return;
    }

    const cost = 50;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    clickSpeedLevel += 1;

    resultEl.textContent =
        `🎉 Click Speed upgraded to ${clickSpeedLevel}/5! Delay: ${clickSpeedDelays[clickSpeedLevel].toFixed(2)} seconds`;

    updateUI();

    updateRebirthButtons();

    save();
}

function upgradeMultiplier(){

    if(multiplierLevel >= MAX_MULTIPLIER_LEVEL){

        resultEl.textContent =
            "✅ Click Multiplier is already maxed at 20/20!";

        showNotification(
            "⚡ Already Maxed!",
            "Click Multiplier is already maxed at 20x."
        );

        return;
    }

    const cost = 10;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    multiplierLevel += 1;

    resultEl.textContent =
        `🎉 Click Multiplier upgraded to ${multiplierLevel}/20! Current: ${multiplierLevel}x`;

    updateUI();
    save();
}

function upgradeHatchAmount(){

    if(hatchAmountLevel >= MAX_HATCH_AMOUNT_LEVEL){

        resultEl.textContent =
            "✅ Egg Hatch Amount is already maxed at 3/3!";

        showNotification(
            "🥚 Already Maxed!",
            "Egg Hatch Amount is already maxed at 3/3."
        );

        return;
    }

    const cost = 100;

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    hatchAmountLevel += 1;

    resultEl.textContent =
        `🎉 Egg Hatch Amount upgraded to ${hatchAmountLevel}/3! Current: ${hatchAmountLevel + 1}x`;

    updateUI();
    save();
}

function clickForCoins(){

    if(clickLocked){
        return;
    }

    clickLocked = true;
    totalClicks++;

    const clickButton =
        document.getElementById("clickButton");

    clickButton.disabled = true;


    let petMultiplier = 0;


    for(const pet of equippedPets){

        petMultiplier +=
            getPetMultiplier(pet);

    }


    if(petMultiplier === 0){
        petMultiplier = 1;
    }


    const clickMultiplier =
        (multiplierLevel + 1) *
        shopClickMultiplier;

    let boostMultiplier = 1;

if(clickBoostActive){

    if(Date.now() < clickBoostEndTime){

        boostMultiplier = 2;

    }else{

        clickBoostActive = false;
        clickBoostEndTime = 0;

    }
}

const skinMultiplier =
    clickSkins[equippedClickSkin]?.multiplier || 1;

const earned =
    clickPower *
    petMultiplier *
    clickMultiplier *
    skinMultiplier *
    boostMultiplier;


    coins += earned;


    resultEl.textContent =
        `💰 +${formatCoins(earned)} coins · 🐾 Pet multiplier ×${formatCoins(petMultiplier)}`;


    updateUI();

    save();


    setTimeout(() => {

        clickLocked = false;

        clickButton.disabled = false;

    }, clickSpeedDelays[clickSpeedLevel] * 1000);
}

function allIndexPets(){
    const output=[];
    for(const [eggName,data] of Object.entries(eggs)){
        const list=[];
        for(const pet of data.pets){
            for(const mutation of mutationNames) list.push(mutation+pet[0]);
        }
        output.push([eggName,list]);
    }

    output.push(["👁️ Embryon",[
        "Embryon","Shiny Embryon","Golden Embryon","Rainbow Embryon",
        "Dark Matter Embryon","Shiny Golden Embryon","Shiny Rainbow Embryon","Shiny Dark Matter Embryon"
    ]]);

    output.push(["👑 Mystorius",[
        "Mystorius","Shiny Mystorius","Golden Mystorius","Rainbow Mystorius",
        "Dark Matter Mystorius","Shiny Golden Mystorius","Shiny Rainbow Mystorius","Shiny Dark Matter Mystorius"
    ]]);

    return output;
}

function renderIndex(){
    const sections=document.getElementById("indexSections");
    const all=allIndexPets();
    sections.innerHTML=all.map(([section,pets])=>{
        return `<div class="index-section"><h3>${section}</h3><div class="index-section-grid">
        ${pets.map(name=>discovered.has(name)
            ? `<div class="index-card"><div class="emoji">${emojiForPet(name)}</div><strong>${name}</strong><small>Discovered</small></div>`
            : `<div class="index-card locked"><strong>❓ ???</strong><small>Undiscovered</small></div>`
        ).join("")}</div></div>`;
    }).join("");

    document.getElementById("indexCount").textContent=`${discovered.size} / 246 discovered`;
    document.getElementById("indexProgress").style.width=`${Math.min(discovered.size/246*100,100)}%`;
}

function emojiForPet(name){
    const stripped=name.replace(/^(Shiny Dark Matter |Dark Matter |Shiny Golden |Shiny Rainbow |Shiny Superior |Shiny |Golden |Rainbow |Superior )/,"");
    const p=findPetData(stripped);
    if(p) return p[1];
    if(stripped==="Embryon") return "🐣";
    if(stripped==="Mystorius") return "🎲";
    return "🐾";
}

function equipPet(name){

    if(equippedPets.length >= MAX_EQUIPPED){

        resultEl.textContent =
            `❌ You can only equip ${MAX_EQUIPPED} pets!`

        return;
    }

    const owned = inventory[name] || 0;

    const equipped = equippedPets.filter(
        pet => pet === name
    ).length;

    if(owned <= equipped){

        resultEl.textContent =
            "❌ You don't have an unequipped copy of that pet!";

        return;
    }

    equippedPets.push(name);

    renderInventory();

    updateUI();

    save();
}


function unequipPet(name){

    const index = equippedPets.indexOf(name);

    if(index === -1){
        return;
    }

    equippedPets.splice(index, 1);

    renderInventory();

    updateUI();

    save();
}


function equipBest(){

    equippedPets = [];

    const candidates = [];

    for(const name of Object.keys(inventory)){

        const amount = inventory[name] || 0;

        for(let i = 0; i < amount; i++){

            candidates.push({
                name: name,
                multiplier: getPetMultiplier(name)
            });

        }

    }

    candidates.sort(
        (a,b) => b.multiplier - a.multiplier
    );

    equippedPets = candidates
        .slice(0, MAX_EQUIPPED)
        .map(pet => pet.name);

    renderInventory();
    updateUI();
    save();
    showNotification(
        "🐾 Equip Best!",
        "Successfully equipped your best pets!"
    );
}

function renderInventory(){

    const equippedBox =
        document.getElementById("equippedGrid");

    const equippedCount =
        document.getElementById("equippedCount");

    const box =
        document.getElementById("inventoryGrid");


    equippedCount.textContent =
        `${equippedPets.length} / ${MAX_EQUIPPED} equipped`;


    equippedBox.innerHTML = "";


    for(let i = 0; i < MAX_EQUIPPED; i++){

        const pet = equippedPets[i];


        if(!pet){

            equippedBox.innerHTML += `
                <div class="equipped-slot empty">

                    <div class="emoji">🐾</div>

                    <strong>Empty slot</strong>

                    <small>Equip a pet here</small>

                </div>
            `;

            continue;
        }


        equippedBox.innerHTML += `
            <div class="equipped-slot">

                <div class="emoji">
                    ${emojiForPet(pet)}
                </div>

                <strong>${pet}</strong>

                <small>
                    ×${getPetMultiplier(pet).toFixed(2)}
                    click power
                </small>

                <button
                    class="secondary-button"
                    onclick="unequipPet('${pet.replace(/'/g, "\\'")}')"
                >
                    UNEQUIP
                </button>

            </div>
        `;
    }


    const names =
    Object.keys(inventory)

    .filter(name => inventory[name] > 0)

    .sort(
        (a,b) =>
            getPetMultiplier(b) -
            getPetMultiplier(a)
    );


    if(!names.length){

        box.innerHTML = `
            <div class="empty-card">

                🎒 Your inventory is empty.
                Hatch an egg!

            </div>
        `;

        return;
    }


    box.innerHTML = names.map(name => {

        const owned =
            inventory[name] || 0;

        const equipped =
            equippedPets.filter(
                pet => pet === name
            ).length;

        const available =
            owned - equipped;


        let button = "";


        if(
            available > 0 &&
            equippedPets.length < MAX_EQUIPPED
        ){

            button = `
                <button
                    onclick="equipPet('${name.replace(/'/g, "\\'")}')"
                >
                    EQUIP
                </button>
            `;

        }else if(available <= 0){

            button = `
                <button disabled>
                    EQUIPPED
                </button>
            `;

        }else{

            button = `
                <button disabled>
                    NO SLOT
                </button>
            `;
        }


        return `
            <div class="pet-card">

                <div class="emoji">
                    ${emojiForPet(name)}
                </div>

                <strong>${name}</strong>

                <small>
                    Owned: ${owned}
                    · Equipped: ${equipped}
                    · Available: ${available}
                    · ×${getPetMultiplier(name).toFixed(2)}
                </small>

                ${button}

            </div>
        `;

    }).join("");
}

function updateUpgradeUI(){

    document.getElementById("upgradeCoins").textContent =
        formatCoins(coins);

    document.getElementById("upgradeGems").textContent =
        formatCoins(gems);


    // CLICK SPEED

    document.getElementById("clickSpeedLevel").textContent =
        `${clickSpeedLevel} / ${MAX_CLICK_SPEED}`;

    document.getElementById("clickSpeedCurrent").textContent =
        `${clickSpeedDelays[clickSpeedLevel].toFixed(2)} seconds`;

    document.getElementById("clickSpeedCost").textContent =
        clickSpeedLevel >= MAX_CLICK_SPEED
            ? "MAX"
            : "50 gems";


    // CLICK MULTIPLIER

    document.getElementById("multiplierLevel").textContent =
        `${multiplierLevel} / ${MAX_MULTIPLIER_LEVEL}`;

    document.getElementById("multiplierCurrent").textContent =
        `${Math.min(multiplierLevel, MAX_MULTIPLIER_LEVEL)}x`;

    document.getElementById("multiplierNext").textContent =
        multiplierLevel >= MAX_MULTIPLIER_LEVEL
            ? "MAX"
            : `${multiplierLevel + 2}x`;

    document.getElementById("multiplierCost").textContent =
        multiplierLevel >= MAX_MULTIPLIER_LEVEL
            ? "MAX"
            : "10 gems";


    // MORE REBIRTHS

    document.getElementById("rebirthUpgradeLevel").textContent =
        `${rebirthUpgradeLevel} / ${MAX_REBIRTH_UPGRADE}`;

    const nextRebirth =
        rebirthUpgradeAmounts[rebirthUpgradeLevel];

    document.getElementById("rebirthUpgradeNext").textContent =
        rebirthUpgradeLevel >= MAX_REBIRTH_UPGRADE
            ? "MAX"
            : `Rebirth ${formatRebirthAmount(nextRebirth)}`;

    document.getElementById("rebirthUpgradeCost").textContent =
        rebirthUpgradeLevel >= MAX_REBIRTH_UPGRADE
            ? "MAX"
            : "10 gems";


    // HATCH AMOUNT

    document.getElementById("hatchAmountLevel").textContent =
        `${hatchAmountLevel} / ${MAX_HATCH_AMOUNT_LEVEL}`;

    document.getElementById("hatchAmountCurrent").textContent =
        `${hatchAmountLevel + 1}x`;

    document.getElementById("hatchAmountNext").textContent =
        hatchAmountLevel >= MAX_HATCH_AMOUNT_LEVEL
            ? "MAX"
            : `${hatchAmountLevel + 2}x`;

    document.getElementById("hatchAmountCost").textContent =
        hatchAmountLevel >= MAX_HATCH_AMOUNT_LEVEL
            ? "MAX"
            : "100 gems";


    // LUCK

    document.getElementById("luckLevel").textContent =
        `${luckLevel} / ${MAX_LUCK_LEVEL}`;

    document.getElementById("luckCurrent").textContent =
        `${(1 + luckLevel * 0.1).toFixed(1)}x`;

    document.getElementById("luckNext").textContent =
        luckLevel >= MAX_LUCK_LEVEL
            ? "MAX"
            : `${(1 + (luckLevel + 1) * 0.1).toFixed(1)}x`;

    document.getElementById("luckCost").textContent =
        luckLevel >= MAX_LUCK_LEVEL
            ? "MAX"
            : "50 gems";


    // PET EQUIP

    MAX_EQUIPPED =
        getMaxEquipped();

    document.getElementById("equipCurrent").textContent =
        `${MAX_EQUIPPED} / 5 pets`;

    document.getElementById("equipNext").textContent =
        MAX_EQUIPPED >= 5
            ? "MAX"
            : `${MAX_EQUIPPED + 1} pets`;

    document.getElementById("equipCost").textContent =
        equipUpgradeLevel >= MAX_EQUIP_UPGRADE_LEVEL
            ? "MAX"
            : equipUpgradeLevel === 0
                ? "500 gems"
                : "2,000 gems";


    // AUTO REBIRTH

    document.getElementById("autoRebirthStatus").textContent =
        autoRebirthPurchased
            ? "PURCHASED"
            : "NOT PURCHASED";

    document.getElementById("autoRebirthCost").textContent =
        autoRebirthPurchased
            ? "OWNED"
            : "100 gems";
}

document.getElementById("hatchButton").addEventListener(
    "click",
    hatch
);

document.getElementById("rebirthButton").addEventListener(
    "click",
    rebirth
);

const rebirthUpgradeButton =
    document.getElementById("rebirthUpgradeButton");

if(rebirthUpgradeButton){
    rebirthUpgradeButton.addEventListener(
        "click",
        upgradeRebirths
    );
}

document.getElementById("clickButton").addEventListener(
    "click",
    clickForCoins
);

document.getElementById("equipBestButton").addEventListener(
    "click",
    equipBest
);

document.querySelectorAll(".nav").forEach(button=>{
    button.addEventListener("click",()=>{
        document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));
        button.classList.add("active");
        document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
        document.getElementById(button.dataset.page).classList.remove("hidden");
    });
});

document.getElementById("clickSpeedUpgrade").addEventListener(
    "click",
    upgradeClickSpeed
);

document.getElementById("multiplierUpgrade").addEventListener(
    "click",
    upgradeMultiplier
);

document.getElementById("hatchAmountUpgrade").addEventListener(
    "click",
    upgradeHatchAmount
);

document.getElementById("luckUpgrade").addEventListener(
    "click",
    upgradeLuck
);

document.getElementById("equipUpgrade").addEventListener(
    "click",
    upgradeEquip
);

document.getElementById("autoRebirthUpgrade").addEventListener(
    "click",
    upgradeAutoRebirth
);

document.getElementById("selectAutoRebirthButton").addEventListener(
    "click",
    selectAutoRebirth
);

document.getElementById("toggleAutoRebirthButton").addEventListener(
    "click",
    toggleAutoRebirth
);

document
    .getElementById("adminSearchButton")
    .addEventListener("click", async () => {

        const username =
            document
                .getElementById("adminPlayerSearch")
                .value
                .trim();

        const result =
            document
                .getElementById("adminPlayerResult");

        const controls =
            document
                .getElementById("adminControls");

        result.textContent = "";
        controls.classList.add("hidden");

        if(!username){
            result.textContent =
                "Enter a username.";
            return;
        }

        const {
            data,
            error
        } = await supabaseClient
            .from("usernames")
            .select("username, user_id")
            .eq("username", username)
            .maybeSingle();

        if(error){

            console.error(
                "Admin search error:",
                error
            );

            result.textContent =
                "Search failed.";

            return;
        }

        if(!data){

            result.textContent =
                "Player not found.";

            return;
        }

        adminTargetUserId =
            data.user_id;

        adminTargetUsername =
            data.username;

        document
            .getElementById("adminTargetName")
            .textContent =
            "Editing: " + data.username;

        result.textContent =
            "Player found.";

        controls.classList.remove("hidden");

    });

document
    .getElementById("adminSaveButton")
    .addEventListener("click", async () => {

        if(!adminTargetUserId){
            return;
        }

        const changes = {};

        const coinsValue =
            document
                .getElementById("adminCoins")
                .value;

        const gemsValue =
            document
                .getElementById("adminGems")
                .value;

        const rebirthsValue =
            document
                .getElementById("adminRebirths")
                .value;

        const clickPowerValue =
            document
                .getElementById("adminClickPower")
                .value;

        if(coinsValue !== ""){
            changes.coins =
                Number(coinsValue);
        }

        if(gemsValue !== ""){
            changes.gems =
                Number(gemsValue);
        }

        if(rebirthsValue !== ""){
            changes.rebirths =
                Number(rebirthsValue);
        }

        if(clickPowerValue !== ""){
            changes.clickPower =
                Number(clickPowerValue);
        }

        if(Object.keys(changes).length === 0){
            alert("Enter at least one value.");
            return;
        }

        const {
            error
        } = await supabaseClient
            .rpc(
                "admin_update_player",
                {
                    target_user_id:
                        adminTargetUserId,

                    changes:
                        changes
                }
            );

        if(error){

            console.error(
                "Admin update error:",
                error
            );

            alert(
                "Admin update failed."
            );

            return;
        }

        alert(
            adminTargetUsername +
            " updated successfully."
        );

    });

document
    .getElementById("adminResetButton")
    .addEventListener("click", async () => {

        if(!adminTargetUserId){
            return;
        }

        const confirmed =
            confirm(
                "Reset " +
                adminTargetUsername +
                "'s entire game?"
            );

        if(!confirmed){
            return;
        }

        const {
            error
        } = await supabaseClient
            .rpc(
                "admin_reset_player",
                {
                    target_user_id:
                        adminTargetUserId
                }
            );

        if(error){

            console.error(
                "Admin reset error:",
                error
            );

            alert(
                "Reset failed."
            );

            return;
        }

        alert(
            adminTargetUsername +
            " has been reset."
        );

    });

document
    .getElementById("adminButton")
    .addEventListener("click", () => {

        document
            .getElementById("adminPanel")
            .classList
            .toggle("hidden");

    });

document.getElementById("shopClickMultiplierButton").addEventListener("click", () => {

    if(shopClickMultiplier >= MAX_SHOP_CLICK_MULTIPLIER){

        resultEl.textContent =
            "✅ Click Multiplier is already maxed at 20x!";

        showNotification(
            "⚡ Already Maxed!",
            "Shop Click Multiplier is already maxed at 20x."
        );

        return;
    }

    if(coins < shopClickMultiplierCost){

        resultEl.textContent =
            "❌ You don't have enough coins!";

        showNotification(
            "❌ Not Enough Coins!",
            "You don't have enough coins for this purchase."
        );

        return;
    }

    coins -= shopClickMultiplierCost;

    shopClickMultiplier += 1;

    shopPurchases++;

    checkAchievements();

    shopClickMultiplierCost =
        Math.floor(shopClickMultiplierCost * 2.5);

    resultEl.textContent =
        `⚡ Click Multiplier upgraded to ${shopClickMultiplier}x!`;

    updateUI();
    save();

});

document.getElementById("clickBoostButton").addEventListener("click", () => {

    if(coins < clickBoostCost){

        resultEl.textContent =
            "❌ You don't have enough coins!";

        showNotification(
            "❌ Not Enough Coins!",
            "You don't have enough coins for this purchase."
        );

        return;
    }

    if(clickBoostActive){

        resultEl.textContent =
            "⚡ Click Boost is already active!";

        return;
    }

    coins -= clickBoostCost;

    clickBoostCost =
        Math.floor(clickBoostCost * 2.5);

    clickBoostActive = true;

    shopPurchases++;

    unlockAchievement("Activate 2x Coins Boost");

    checkAchievements();

    clickBoostEndTime =
        Date.now() + (300 * 1000);

    resultEl.textContent =
        "⚡ Click Boost activated for 5 minutes!";

    updateUI();
    save();

});

document.getElementById("mysteryBoxButton").addEventListener("click", () => {

    if(coins < mysteryBoxCost){

        resultEl.textContent =
            "❌ You don't have enough coins!";

        showNotification(
            "❌ Not Enough Coins!",
            "You don't have enough coins for this purchase."
        );

        return;
    }

    coins -= mysteryBoxCost;

    mysteryBoxesOpened++;

    unlockAchievement("Open Your First Mystery Box");

    checkAchievements();

    mysteryBoxCost =
        Math.floor(mysteryBoxCost * 2.5);

    const mysteryRoll =
        Math.random() * 100;

    const mysteryOverlay =
        document.getElementById("mysteryOverlay");

    const mysteryBoxAnimation =
        document.querySelector(".mystery-box-animation");

    const mysteryReveal =
        document.getElementById("mysteryReveal");

    const mysteryRevealText =
        document.getElementById("mysteryRevealText");

    mysteryOverlay.classList.add("active");

    mysteryBoxAnimation.style.display = "block";
    mysteryReveal.classList.remove("show");

    resultEl.textContent =
        "🎲 Opening Mystery Box...";

    setTimeout(() => {

        mysteryBoxAnimation.style.display = "none";

        mysteryRevealText.textContent = "";
        mysteryReveal.classList.add("show");

        // ======================================
        // 👑 0.01% — SPECIAL MYSTORIUS
        // ======================================

        if(mysteryRoll < 0.01){

            const shinyRoll =
                Math.floor(Math.random() * 100) + 1;

            const goldenRoll =
                Math.floor(Math.random() * 100) + 1;

            const rainbowRoll =
                Math.floor(Math.random() * 100) + 1;

            const darkMatterRoll =
                Math.floor(Math.random() * 100) + 1;

            let mysteryPet;

            if(
                darkMatterRoll === 1 &&
                shinyRoll <= 5
            ){

                mysteryPet =
                    "Shiny Dark Matter Mystorius";

            }else if(
                shinyRoll <= 5 &&
                goldenRoll <= 25
            ){

                mysteryPet =
                    "Shiny Golden Mystorius";

            }else if(
                shinyRoll <= 5 &&
                rainbowRoll <= 10
            ){

                mysteryPet =
                    "Shiny Rainbow Mystorius";

            }else if(
                darkMatterRoll === 1
            ){

                mysteryPet =
                    "Dark Matter Mystorius";

            }else if(
                goldenRoll <= 25
            ){

                mysteryPet =
                    "Golden Mystorius";

            }else if(
                rainbowRoll <= 10
            ){

                mysteryPet =
                    "Rainbow Mystorius";

            }else if(
                shinyRoll <= 5
            ){

                mysteryPet =
                    "Shiny Mystorius";

            }else{

                mysteryPet =
                    "Mystorius";

            }

            inventory[mysteryPet] =
                (inventory[mysteryPet] || 0) + 1;

            discovered.add(mysteryPet);

            mysteryRevealText.textContent =
                `👑 ${mysteryPet} · ×${formatCoins(getPetMultiplier(mysteryPet))}`;

            resultEl.textContent =
                `👑 SPECIAL PET DISCOVERED! ✨ ${mysteryPet} · ×${formatCoins(getPetMultiplier(mysteryPet))}`;

        }

        // ======================================
        // 💰 29.99% — 1.2X CURRENT COINS
        // ======================================

        else if(mysteryRoll < 30){

            const reward =
                Math.floor(coins * 1.2);

            coins += reward;

            mysteryRevealText.textContent =
                `💰 +${formatCoins(reward)} Coins!`;

            resultEl.textContent =
                `🎉 Mystery Box Reward! 💰 +${formatCoins(reward)} coins! · 1.2× current coins`;

        }

        // ======================================
        // 💰 25% — 1.5X CURRENT COINS
        // ======================================

        else if(mysteryRoll < 55){

            const reward =
                Math.floor(coins * 0.5);

            coins += reward;

            mysteryRevealText.textContent =
                `💰 +${formatCoins(reward)} Coins!`;

            resultEl.textContent =
                `🎉 Mystery Box Reward! 💰 +${formatCoins(reward)} coins! · 1.5× current coins`;

        }

        // ======================================
        // 🍀 20% — LUCKY BOOST
        // ======================================

        else if(mysteryRoll < 75){

            luckyBoostActive = true;

            shopPurchases++;

            unlockAchievement("Activate Lucky Boost");

            checkAchievements();

            luckyBoostEndTime =
                Date.now() + (300 * 1000);

            mysteryRevealText.textContent =
                "🍀 Lucky Boost · 5 Minutes!";

            resultEl.textContent =
                "🎉 Mystery Box Reward! 🍀 Lucky Boost activated for 5 minutes!";

        }

        // ======================================
        // ⚡ 12% — 2X COINS BOOST
        // ======================================

        else if(mysteryRoll < 87){

            clickBoostActive = true;

            clickBoostEndTime =
                Date.now() + (300 * 1000);

            mysteryRevealText.textContent =
                "⚡ 2× Coins Boost · 5 Minutes!";

            resultEl.textContent =
                "🎉 Mystery Box Reward! ⚡ 2× Coins Boost activated for 5 minutes!";

        }

        // ======================================
        // 💰 7% — 3X CURRENT COINS
        // ======================================

        else if(mysteryRoll < 94){

            const reward =
                coins * 3;

            coins += reward;

            mysteryRevealText.textContent =
                `🎉 JACKPOT! +${formatCoins(reward)} Coins!`;

            resultEl.textContent =
                `🎉🎉 JACKPOT! 🎉🎉 💰 +${formatCoins(reward)} coins! · 3× current coins`;

        }

        // ======================================
        // 💎 4% — 5X CURRENT COINS
        // ======================================

        else if(mysteryRoll < 98){

            const reward =
                coins * 5;

            coins += reward;

            mysteryRevealText.textContent =
                `💎 MEGA JACKPOT! +${formatCoins(reward)} Coins!`;

            resultEl.textContent =
                `💎💎 MEGA JACKPOT! 💎💎 +${formatCoins(reward)} coins! · 5× current coins`;

        }

        // ======================================
        // 🔥 2% — 10X CURRENT COINS
        // ======================================

        else{

            const reward =
                coins * 10;

            coins += reward;

            mysteryRevealText.textContent =
                `🔥 ULTRA JACKPOT! +${formatCoins(reward)} Coins!`;

            resultEl.textContent =
                `🔥🔥 ULTRA JACKPOT! 🔥🔥 +${formatCoins(reward)} coins! · 10× current coins`;

        }

        setTimeout(() => {

            mysteryOverlay.classList.remove("active");
            mysteryReveal.classList.remove("show");

            mysteryBoxAnimation.style.display = "none";
            mysteryRevealText.textContent = "";

        }, 2500);

        updateUI();
        save();

        }, 1000);

});

document.getElementById("luckyBoostButton").addEventListener("click", () => {

    if(coins < luckyBoostCost){

        resultEl.textContent =
            "❌ You don't have enough coins!";

        showNotification(
            "❌ Not Enough Coins!",
            "You don't have enough coins for this purchase."
        );

        return;
    }

    if(luckyBoostActive){

        resultEl.textContent =
            "🍀 Lucky Boost is already active!";

        return;
    }

    coins -= luckyBoostCost;

    luckyBoostCost =
        Math.floor(luckyBoostCost * 2.5);

    luckyBoostActive = true;

    luckyBoostEndTime =
        Date.now() + (300 * 1000);

    resultEl.textContent =
        "🍀 Lucky Boost activated for 5 minutes!";

    updateUI();
    save();

});

document.getElementById("goldenMachineButton").addEventListener("click", () => {
    craftMachine("Golden");
});

document.getElementById("rainbowMachineButton").addEventListener("click", () => {
    craftMachine("Rainbow");
});

document.getElementById("darkMatterMachineButton").addEventListener("click", () => {
    craftMachine("Dark Matter");
});

document.getElementById("superiorMachineButton").addEventListener("click", () => {
    craftMachine("Superior");
});

document.getElementById("craftAllMachineButton").addEventListener("click", () => {
    craftAllMachines();
});

// Online account loading happens in restoreLogin()

async function restoreLogin(){

    document
        .getElementById("logoutButton")
        .textContent = "LOGIN";

    const loggedInUser =
        await getCurrentUser();

    if(!loggedInUser){

        document
            .getElementById("accountScreen")
            .classList.remove("hidden");

        document
            .getElementById("gameScreen")
            .classList.remove("hidden");

        document
            .getElementById("gameScreen")
            .classList.add("hidden");

        return;
    }

    currentUser = loggedInUser;
    await checkAdmin();

    document
    .getElementById("accountScreen")
    .classList.add("hidden");

    document
        .getElementById("gameScreen")
        .classList.remove("hidden");

    document
        .getElementById("logoutButton")
        .textContent = "LOG OUT";

    const {
        data: usernameData,
        error: usernameError
    } = await supabaseClient
        .from("usernames")
        .select("username")
        .eq("user_id", loggedInUser.id)
        .maybeSingle();

    if(usernameError){

        console.error(
            "Username restore error:",
            usernameError
        );

        return;
    }

    if(usernameData){

        localStorage.setItem(
            "playerUsername",
            usernameData.username
        );

        document
            .getElementById("playerUsername")
            .textContent =
            usernameData.username;

        document
            .getElementById("accountScreen")
            .classList.add("hidden");

        await load();

        MAX_EQUIPPED = getMaxEquipped();

        renderEggs();
        renderInventory();
        renderIndex();
        updateUI();
        renderAchievements();
        renderClickSkins();
        updateRebirthButtons();
    }
}

async function checkAdmin(){

    if(!currentUser){
        return;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq(
            "user_id",
            currentUser.id
        )
        .maybeSingle();

    if(error){

        console.error(
            "Admin check error:",
            error
        );

        return;
    }

    const adminButton =
        document
            .getElementById("adminButton");

    if(data){

        adminButton
            .classList
            .remove("hidden");

    }else{

        adminButton
            .classList
            .add("hidden");

    }
}

restoreLogin().then(() => {

    document
        .getElementById("logoutButton")
        .textContent = currentUser
            ? "LOG OUT"
            : "LOGIN";

    document
        .getElementById("gameScreen")
        .classList.toggle(
            "hidden",
            !currentUser
        );

    document
        .getElementById("accountScreen")
        .classList.toggle(
            "hidden",
            !!currentUser
        );

    initializeLeaderboard();

    MAX_EQUIPPED = getMaxEquipped();

    renderEggs();
    renderInventory();
    renderIndex();
    updateUI();
    renderAchievements();
    renderClickSkins();
    updateRebirthButtons();

});
supabaseClient
    .channel("leaderboards-live")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "leaderboards"
        },
        () => {
            loadLeaderboards();
        }
    )
    .subscribe();

setInterval(() => {

    autoRebirthCheck();

}, 100);

setInterval(() => {
    loadLeaderboards();
}, LEADERBOARD_REFRESH_INTERVAL);

setInterval(() => {     

    playTime++;

    if(playTime % 60 === 0){
        save();
    }

    if(
        clickBoostActive &&
        Date.now() >= clickBoostEndTime
    ){

        clickBoostActive = false;
        clickBoostEndTime = 0;

    }

    if(
        luckyBoostActive &&
        Date.now() >= luckyBoostEndTime
    ){

        luckyBoostActive = false;
        luckyBoostEndTime = 0;

    }

    updateUI();

}, 1000);
