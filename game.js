const SUPABASE_URL = "https://elxarqmedqgnighvdqsb.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HS_4nqHQHu_p8XTvoZaeww_dlKUITE7";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

let currentUser = null;

let globalPlayerUsername = "Player";

// 🌎 GET REAL PLAYER USERNAME
function getGlobalUsername(){

    return globalPlayerUsername || "Player";

}

// =========================================================
// 🌎 GLOBAL HATCH + CHAT
// =========================================================

let globalChatCooldown = false;

const GLOBAL_CHAT_COOLDOWN = 1500;

let accountResetVersion = 0;
let loadingOnlineSave = false;
let autoRebirthPurchased = false;
let adminResetInProgress = false;
let autoRebirthEnabled = false;
let autoRebirthTarget = 1;

if(!window.petLevels){
    window.petLevels = {};
}

async function getCurrentUser(){

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    currentUser = user;

    if(currentUser){

        const savedUsername =
            localStorage.getItem("playerUsername");

        if(savedUsername){

            globalPlayerUsername =
                savedUsername
                    .trim()
                    .slice(0,16);

        }else{

            const {
                data,
                error
            } = await supabaseClient
                .from("usernames")
                .select("username")
                .eq("user_id", currentUser.id)
                .maybeSingle();

            if(!error && data?.username){

                globalPlayerUsername =
                    data.username
                        .trim()
                        .slice(0,16);

            }

        }

    }

    console.log(
        "🌎 GLOBAL PLAYER USERNAME:",
        globalPlayerUsername
    );

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

    document
        .getElementById("adminCloseButton")
        .addEventListener("click", () => {

            document
                .getElementById("adminPanel")
                .classList
                .add("hidden");

    });

    document
        .getElementById("autoRebirthCloseButton")
        .onclick = () => {

            document
                .getElementById("autoRebirthPanel")
                .classList
                .add("hidden");

        };

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

    startLiveSync();

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

    startLiveSync();

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
let rebirthCost = 100;
let selectedRebirthAmount = 1;
let gems = 0;
let rebirthUpgradeLevel = 0;
const MAX_REBIRTH_UPGRADE = 6;

let adminTargetUserId = null;
let adminTargetUsername = null;

let clickSpeedLevel = 0;
let multiplierLevel = 0;
let hatchAmountLevel = 0;
let luckLevel = 1;
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

let fasterHatchLevel = 0;

// 👁️ Embryon Secret Event

let embryonEventActive = false;
let embryonDiceNumber = 0;
let embryonEventLocked = false;

const MAX_FASTER_HATCH_LEVEL = 5;

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

let petPendingDeletion = null;


function openDeletePetConfirm(petName){

    const owned =
        inventory[petName] || 0;

    const equipped =
        equippedPets.filter(
            pet => pet === petName
        ).length;

    const available =
        owned - equipped;

    petPendingDeletion = {
        name: petName,
        owned: owned,
        equipped: equipped,
        available: available
    };

    const overlay =
        document.getElementById("deletePetOverlay");

    const preview =
        document.getElementById("deletePetPreview");

    const secretWarning =
        document.getElementById("deletePetSecretWarning");


    const rarity =
        getPetRarity(petName);


    const emoji =
        emojiForPet(petName);


    preview.innerHTML = `
        <div class="delete-pet-emoji">
            ${emoji}
        </div>

        <div class="delete-pet-name">
            ${colourPetName(petName)}
        </div>
    `;


    if(rarity === "Secret"){

        secretWarning.classList.remove(
            "hidden"
        );

    }else{

        secretWarning.classList.add(
            "hidden"
        );
    }


    overlay.classList.remove(
        "hidden"
    );
}


function closeDeletePetConfirm(){

    const overlay =
        document.getElementById("deletePetOverlay");

    overlay.classList.add(
        "hidden"
    );

    petPendingDeletion = null;
}

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
    "Obtain Sung Jin Woo",
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
    100
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

let critChance = 0.05; // 5%
let critMultiplier = 5;

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

    const equipUpgradeCosts = [
        1000,
        5000
    ];

    const cost =
        equipUpgradeCosts[equipUpgradeLevel];

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
                tempCost * 1.5,
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
    "Prototype - A418": 125,

    "Naruto": 37.5,
    "Luffy": 45,
    "Denji": 97.5,
    "Gojo": 150,
    "Vegeta": 225,
    "Sung Jin Woo": 375,
    "MUI Goku": 525,
    "Shenron": 1250,

    "Embryon": 10000000,
    "Mystorius": 7777777,
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
            ["Sung Jin Woo","🖤","Ancient",0.8],
            ["MUI Goku","🌟","Celestial",0.1],
            ["Shenron","🐉","Chromatic",0.01]
        ]
    }
};

const MAX_PET_LEVEL = 100;

function getPetExpRequired(level){
    if(level >= MAX_PET_LEVEL){
        return 0;
    }

    return 100 * level;
}

function getPetLevelData(name){
    if(!window.petLevels){
        window.petLevels = {};
    }

    if(!window.petLevels[name]){
        window.petLevels[name] = {
            level: 1,
            exp: 0
        };
    }

    return window.petLevels[name];
}

function addPetExp(petName, amount){

    const data = getPetLevelData(petName);

    if(data.level >= MAX_PET_LEVEL){
        return false;
    }

    data.exp += amount;

    let leveledUp = false;

    while(
        data.level < MAX_PET_LEVEL &&
        data.exp >= getPetExpRequired(data.level)
    ){

        data.exp -= getPetExpRequired(data.level);

        data.level++;

        leveledUp = true;
    }

    if(data.level >= MAX_PET_LEVEL){
        data.level = MAX_PET_LEVEL;
        data.exp = 0;
    }

    return leveledUp;
}

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

    luckLevel = Math.max(1, Number(luckLevel) || 1);

    const luckValue = document.getElementById("luckValue");

    if(luckValue){

        let currentLuck =
            Number(luckLevel);

        if(
            luckyBoostActive &&
            Date.now() < luckyBoostEndTime
        ){

            currentLuck *= 2;

        }

        luckValue.textContent =
            `${currentLuck.toFixed(1)}x`;
    }

    const autoRebirthStatusEl =
        document.getElementById("autoRebirthStatus");


    const autoRebirthUpgradeEl =
        document.getElementById("autoRebirthUpgrade");

    const autoRebirthControlsEl =
        document.getElementById("autoRebirthControls");

    const toggleAutoRebirthButton =
        document.getElementById("toggleAutoRebirthButton");


    if(autoRebirthPurchased){

        autoRebirthStatusEl.textContent =
            "PURCHASED";

        autoRebirthUpgradeEl.textContent =
            "OWNED";

        document.getElementById("selectedAutoRebirthAmount").textContent =
            "×" + formatRebirthAmount(autoRebirthTarget);

        autoRebirthUpgradeEl.style.display =
            "block";

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

        autoRebirthUpgradeEl.textContent =
            "⬆️ PURCHASE";

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
        `⚡ 2× CLICK · ${secondsLeft}s remaining`;

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
        `🍀 2× LUCK · ${secondsLeft}s remaining`;

}else{

    luckyBoostStatus.textContent = "";

}

    clickPower = rebirths + 1;
    coinsEl.textContent=formatCoins(coins);
    gemsEl.textContent=formatCoins(gems);
    document.getElementById("selectedEggName").textContent=eggs[selectedEgg].emoji+" "+selectedEgg;
    document.getElementById("selectedEggCost").textContent="Cost: "+formatCoins(eggs[selectedEgg].cost)+" 💰";
    document.getElementById("rebirthCoins").textContent = formatCoins(coins);
    document.getElementById("rebirthGems").textContent = formatCoins(gems);
    document.getElementById("rebirthCount").textContent = rebirths;
    document.getElementById("rebirthsTop").textContent = formatRebirthAmount(rebirths);
    document.getElementById("rebirthClickPower").textContent = formatCoins(clickPower) + "x";
    document.getElementById("selectedAutoRebirthAmount").textContent =
        "×" + formatRebirthAmount(autoRebirthTarget);

    updateUpgradeUI();
}

function scheduleOnlineSave(){

    onlineSavePending = true;

    if(onlineSaveTimer){
        clearTimeout(onlineSaveTimer);
    }

    onlineSaveTimer = setTimeout(() => {

        onlineSavePending = false;
        onlineSaveTimer = null;

        save();

    }, 5000);
}

let onlineSaveTimer = null;
let leaderboardSaveTimer = null;
let onlineSaveInProgress = false;

function getGameData(){

    return {
        saveVersion: 1,
        petLevels: window.petLevels || {},
        fasterHatchLevel,
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
}


function save(){

    if(loadingOnlineSave){
        console.warn("SAVE BLOCKED: Online save is still loading.");
        return;
    }

    const gameData =
        getGameData();

    /*
     * ALWAYS save locally immediately.
     */
    localStorage.setItem(
        SAVE_KEY,
        JSON.stringify(gameData)
    );


    /*
     * ONLINE SAVE
     *
     * Wait 5 seconds before uploading.
     *
     * If the player clicks multiple times during
     * those 5 seconds, they all get combined into
     * ONE Supabase upload.
     */
    if(currentUser){

        if(onlineSaveTimer){
            clearTimeout(onlineSaveTimer);
        }

        onlineSaveTimer =
        setTimeout(
            saveOnline,
            1000
        );
    }


    /*
     * LEADERBOARD SAVE
     *
     * Don't upload leaderboard data on every click.
     * Wait 60 seconds instead.
     */
    if(currentUser){

        if(!leaderboardSaveTimer){

            leaderboardSaveTimer =
                setTimeout(
                    async () => {

                        leaderboardSaveTimer = null;

                        await saveLeaderboardStats();

                    },
                    60000
                );
        }
    }
}


async function saveOnline(){

    onlineSaveTimer = null;

    if(!currentUser){
        return;
    }

    // 🚫 Don't save while an admin reset is happening
    if(adminResetInProgress){
        return;
    }

    if(accountResetVersion !== 0){
        return;
    }

    const gameData =
        getGameData();

    onlineSaveInProgress = true;

    try{

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

    }catch(error){

        console.error(
            "Online save exception:",
            error
        );

    }finally{

        onlineSaveInProgress = false;

    }
}

let liveSyncInterval = null;
let liveSyncLoading = false;

async function liveSync(){

    if(!currentUser){
        return;
    }

    if(liveSyncLoading){
        return;
    }

    liveSyncLoading = true;

    try{

        const {
            data,
            error
        } = await supabaseClient
            .from("player_data")
            .select("game_data, reset_version, updated_at")
            .eq("user_id", currentUser.id)
            .maybeSingle();

        if(error){
            console.error(
                "Live sync error:",
                error
            );

            liveSyncLoading = false;
            return;
        }

        if(!data){
            liveSyncLoading = false;
            return;
        }

        if((data.reset_version ?? 0) > 0){

            accountResetVersion = 1;

            coins = 0;
            gems = 0;
            rebirths = 0;
            rebirthCost = 100;
            clickPower = 1;

            rebirthUpgradeLevel = 0;
            clickSpeedLevel = 0;
            multiplierLevel = 0;
            hatchAmountLevel = 0;
            luckLevel = 1;
            equipUpgradeLevel = 0;

            autoRebirthPurchased = false;
            autoRebirthEnabled = false;
            autoRebirthTarget = 1;

            clickBoostActive = false;
            clickBoostEndTime = 0;
            luckyBoostActive = false;
            luckyBoostEndTime = 0;

            shopClickMultiplier = 1;
            selectedEgg = "Starter Egg";
            unlockedEggs = new Set(["Starter Egg"]);

            inventory = {};
            discovered = new Set();
            equippedPets = [];

            totalHatches = 0;
            totalClicks = 0;
            hatchStreak = 0;
            bestHatchStreak = 0;

            unlockedAchievements = new Set();
            ownedClickSkins = new Set(["Classic"]);
            equippedClickSkin = "Classic";

            shopPurchases = 0;
            mysteryBoxesOpened = 0;

            localStorage.removeItem(SAVE_KEY);

            updateUI();
            renderInventory();
            renderIndex();
            renderEggs();

            accountResetVersion = 0;

            liveSyncLoading = false;
            return;
        }

        const d = data.game_data || {};

        coins = d.coins ?? coins;
        gems = d.gems ?? gems;

        rebirths = d.rebirths ?? rebirths;

        rebirthCost = Number(d.rebirthCost ?? 100);

        if(Number(rebirths) === 0){
            rebirthCost = 100;
        }

        if(d.rebirths === 0){
            rebirthCost = 100;
            clickPower = 1;
        }else{
            rebirthCost = Number(d.rebirthCost ?? 100);

            if(rebirths === 0){
                rebirthCost = 100;
            }
            clickPower = d.clickPower ?? clickPower;
        }
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

        fasterHatchLevel =
            Number(
                d.fasterHatchLevel ?? fasterHatchLevel
            );

        fasterHatchLevel =
            Math.max(
                0,
                Math.min(
                    fasterHatchLevel,
                    MAX_FASTER_HATCH_LEVEL
                )
            );

        equipUpgradeLevel =
            d.equipUpgradeLevel ?? equipUpgradeLevel;

        autoRebirthPurchased =
            d.autoRebirthPurchased ?? autoRebirthPurchased;

        autoRebirthEnabled =
            d.autoRebirthEnabled ?? autoRebirthEnabled;

        autoRebirthTarget =
            d.autoRebirthTarget ?? autoRebirthTarget;

        shopClickMultiplier =
            d.shopClickMultiplier ?? shopClickMultiplier;

        selectedEgg =
            d.selectedEgg ?? selectedEgg;

        unlockedEggs =
            new Set(
                d.unlockedEggs ?? ["Starter Egg"]
            );

        inventory =
            d.inventory ?? {};

        window.petLevels =
            d.petLevels ?? {};

        discovered =
            new Set(
                d.discovered ?? []
            );

        equippedPets =
            d.equippedPets ?? [];

        totalHatches =
            d.totalHatches ?? totalHatches;

        hatchStreak =
            d.hatchStreak ?? hatchStreak;

        bestHatchStreak =
            d.bestHatchStreak ?? bestHatchStreak;

        unlockedAchievements =
            new Set(
                d.unlockedAchievements ?? []
            );

        ownedClickSkins =
            new Set(
                d.ownedClickSkins ?? ["Classic"]
            );

        equippedClickSkin =
            d.equippedClickSkin ?? "Classic";

        shopPurchases =
            d.shopPurchases ?? shopPurchases;

        mysteryBoxesOpened =
            d.mysteryBoxesOpened ?? mysteryBoxesOpened;

        localStorage.setItem(
            SAVE_KEY,
            JSON.stringify(d)
        );

        updateUI();
        renderInventory();
        renderIndex();
        renderEggs();

    }catch(error){

        console.error(
            "Live sync exception:",
            error
        );

    }

    liveSyncLoading = false;
}

function startLiveSync(){

    if(liveSyncInterval){
        clearInterval(liveSyncInterval);
    }

    liveSyncInterval =
        setInterval(
            liveSync,
            60000
        );
}

async function load(){

    loadingOnlineSave = true;

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

        accountResetVersion =
            data.reset_version ?? 0;

        if(accountResetVersion > 0){

            console.warn(
                "🔄 Account reset detected. Loading reset data..."
            );

            // The server has already written the reset state
            // into game_data. Load that data normally.

            if(data.game_data){

                raw =
                    JSON.stringify(
                        data.game_data
                    );

                localStorage.setItem(
                    SAVE_KEY,
                    raw
                );

                console.log(
                    "🔄 RESET DATA LOADED:",
                    data.game_data
                );

                console.log(
                    "🔄 RESET REBIRTH CHECK:",
                    {
                        rebirths: data.game_data?.rebirths,
                        rebirthCost: data.game_data?.rebirthCost
                    }
                );

            }

        }else{

            raw =
                JSON.stringify(
                    data.game_data
                );

            localStorage.setItem(
                SAVE_KEY,
                raw
            );

            console.log(
                "ONLINE SAVE LOADED:",
                data.game_data
            );

        }
    }
}

    if(!raw){
        loadingOnlineSave = false;
        return;
    }

    try{

        const d =
            JSON.parse(raw);

        console.log("LOADED SAVE DATA:", {
            coins: d.coins,
            gems: d.gems,
            rebirths: d.rebirths,
            inventory: d.inventory,
            petLevels: d.petLevels
        });

        coins=d.coins ?? coins;
        gems=d.gems ?? gems;
        playTime=d.playTime ?? playTime;
        clickPower=d.clickPower ?? clickPower;
        rebirths=d.rebirths ?? rebirths;
        rebirthCost = Number(d.rebirthCost);

        console.log(
            "🔍 REBIRTH COST FROM DATABASE:",
            d.rebirthCost
        );

        if(!Number.isFinite(rebirthCost)){
            rebirthCost = 100;
        }

        console.log(
            "💰 REBIRTH COST AFTER LOAD:",
            rebirthCost
        );

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

        fasterHatchLevel =
            Number(
                d.fasterHatchLevel ?? 0
            );

        fasterHatchLevel =
            Math.max(
                0,
                Math.min(
                    fasterHatchLevel,
                    MAX_FASTER_HATCH_LEVEL
                )
            );

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

    loadingOnlineSave = false;
    
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

function getPetRarity(name){

    // 👁️ EMBRYON + MYSTORIUS = SECRET
    if(
        name === "Embryon" ||
        name.endsWith("Embryon") ||
        name === "Mystorius" ||
        name.endsWith("Mystorius")
    ){
        return "Secret";
    }

    // 🔎 Search every egg
    for(const eggName in eggs){

        const egg = eggs[eggName];

        if(!egg || !Array.isArray(egg.pets)){
            continue;
        }

        for(const pet of egg.pets){

            if(
                Array.isArray(pet) &&
                pet[0] === name
            ){
                return pet[2];
            }
        }
    }

    return "Unknown";
}

function applyMutation(baseName){

    const roll =
        Math.random() * 100;

    // 95% = normal pet
    if(roll < 95){
        return baseName;
    }

    // 2.5% = Golden
    if(roll < 97.5){
        return "Golden " + baseName;
    }

    // 1.5% = Shiny
    if(roll < 99){
        return "Shiny " + baseName;
    }

    // 0.7% = Rainbow
    if(roll < 99.7){
        return "Rainbow " + baseName;
    }

    // 0.2% = Dark Matter
    if(roll < 99.9){
        return "Dark Matter " + baseName;
    }

    // 0.05% = Shiny Golden
    if(roll < 99.95){
        return "Shiny Golden " + baseName;
    }

    // 0.04% = Shiny Rainbow
    if(roll < 99.99){
        return "Shiny Rainbow " + baseName;
    }

    // 0.01% = Shiny Dark Matter
    return "Shiny Dark Matter " + baseName;
}

function colourPetName(pet){

    if(pet.startsWith("Shiny Golden ")){
        const name = pet.slice(13);

        return `
            <span class="mutation-shiny">✨Shiny✨</span>
            <span class="mutation-golden">Golden</span>
            ${name}
        `;
    }

    if(pet.startsWith("Shiny Rainbow ")){
        const name = pet.slice(14);

        return `
            <span class="mutation-shiny">✨Shiny✨</span>
            <span class="mutation-rainbow">
                <span>R</span><span>a</span><span>i</span><span>n</span><span>b</span><span>o</span><span>w</span>
            </span>
            ${name}
        `;
    }

    if(pet.startsWith("Shiny Dark Matter ")){
        const name = pet.slice(18);

        return `
            <span class="mutation-shiny">✨Shiny✨</span>
            <span class="mutation-dark-matter">Dark Matter</span>
            ${name}
        `;
    }

    if(pet.startsWith("Shiny Superior ")){
        const name = pet.slice(15);

        return `
            <span class="mutation-shiny">✨Shiny✨</span>
            <span class="mutation-superior">⭐Superior⭐</span>
            ${name}
        `;
    }

    if(pet.startsWith("Shiny ")){
        const name = pet.slice(6);

        return `
            <span class="mutation-shiny">✨Shiny✨</span>
            ${name}
        `;
    }

    if(pet.startsWith("Golden ")){
        const name = pet.slice(7);

        return `
            <span class="mutation-golden">Golden</span>
            ${name}
        `;
    }

    if(pet.startsWith("Rainbow ")){
        const name = pet.slice(8);

        return `
            <span class="mutation-rainbow">
                <span>R</span><span>a</span><span>i</span><span>n</span><span>b</span><span>o</span><span>w</span>
            </span>
            ${name}
        `;
    }

    if(pet.startsWith("Dark Matter ")){
        const name = pet.slice(12);

        return `
            <span class="mutation-dark-matter">Dark Matter</span>
            ${name}
        `;
    }

    if(pet.startsWith("Superior ")){
        const name = pet.slice(9);

        return `
            <span class="mutation-superior">⭐Superior⭐</span>
            ${name}
        `;
    }

    return pet;
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

    const baseMultiplier =
        basePetMultipliers[cleanName] ?? 1;

    const mutationMultiplier =
        mutationMultipliers[mutation] ?? 1;

    // 🐾 PET LEVEL BONUS
    const petLevelData =
        getPetLevelData(name);

    const level =
        Math.max(
            1,
            Math.min(
                MAX_PET_LEVEL,
                petLevelData.level || 1
            )
        );

    // Each level adds 1% to the pet's multiplier
    const levelMultiplier =
        1 + ((level - 1) * 0.01);

    return (
        baseMultiplier *
        mutationMultiplier *
        levelMultiplier
    );
}

function findPetData(name){
    for(const egg of Object.values(eggs)){
        for(const p of egg.pets){
            if(p[0]===name) return p;
        }
    }
    return null;
}

function formatRarity(rarity){

    switch(rarity){

        case "Ancient":
            return "𝙰𝚗𝚌𝚒𝚎𝚗𝚝";

        case "Celestial":
            return "𝒞𝑒𝓁𝑒𝓈𝓉𝒾𝒶𝓁";

        case "Chromatic":
            return "𝐂𝐇𝐑𝐎𝐌𝐀𝐓𝐈𝐂";

        case "Secret":
            return "𝚜𝚎𝚌𝚛𝚎𝚝";

        default:
            return rarity;
    }

}

function shouldTriggerEmbryonEvent(){

    return Math.random() < (1 / 10000);

}

function rollEmbryonMutation(){

    const roll =
        Math.random() * 100;

    if(roll < 0.2){
        return "Shiny Dark Matter ";
    }

    if(roll < 1){
        return "Shiny Rainbow ";
    }

    if(roll < 2){
        return "Shiny Golden ";
    }

    if(roll < 4){
        return "Dark Matter ";
    }

    if(roll < 8){
        return "Rainbow ";
    }

    if(roll < 15){
        return "Golden ";
    }

    if(roll < 30){
        return "Shiny ";
    }

    return "";

}

function rollEmbryonDice(){

    const dice =
        document.getElementById(
            "embryonDice"
        );

    const diceText =
        document.getElementById(
            "embryonDiceText"
        );

    dice.classList.add("rolling");

    diceText.textContent =
        "🎲 Rolling...";

    let elapsed = 0;

    const rollInterval =
        setInterval(() => {

            // Show fake numbers while rolling
            dice.textContent =
                Math.floor(
                    Math.random() * 20
                ) + 1;

            elapsed += 100;

            if(elapsed >= 2500){

                clearInterval(
                    rollInterval
                );

                dice.classList.remove(
                    "rolling"
                );

                // Secretly choose the real number
                embryonDiceNumber =
                    Math.floor(
                        Math.random() * 20
                    ) + 1;

                // HIDE THE REAL NUMBER
                dice.textContent = "?";

                diceText.textContent =
                    "🔮 THE FATE HAS BEEN SEALED...";

                setTimeout(() => {

                    diceText.textContent =
                        "👁️ Embryon is waiting for your choice...";

                    setTimeout(() => {

                        showEmbryonGuess();

                    }, 1000);

                }, 1500);

            }

        },100);

}

function showEmbryonGuess(){

    const dialogue =
        document.getElementById(
            "embryonDialogue"
        );

    const diceArea =
        document.getElementById(
            "embryonDiceArea"
        );

    const guessArea =
        document.getElementById(
            "embryonGuessArea"
        );

    const grid =
        document.getElementById(
            "embryonNumberGrid"
        );

    diceArea.classList.add("hidden");

    guessArea.classList.remove(
        "hidden"
    );

    dialogue.textContent =
        "Choose wisely...";

    grid.innerHTML = "";

    for(let i = 1; i <= 20; i++){

        const button =
            document.createElement("button");

        button.className =
            "embryon-number-button";

        button.textContent =
            i;

        button.addEventListener(
            "click",
            () => {
                chooseEmbryonNumber(i);
            }
        );

        grid.appendChild(button);

    }

}

function chooseEmbryonNumber(
    selectedNumber
){

    if(embryonEventLocked === false){
        return;
    }

    embryonEventLocked = false;

    const buttons =
        document.querySelectorAll(
            ".embryon-number-button"
        );

    buttons.forEach(button => {
        button.disabled = true;
    });

    const dialogue =
        document.getElementById(
            "embryonDialogue"
        );

    const guessArea =
        document.getElementById(
            "embryonGuessArea"
        );

    const resultArea =
        document.getElementById(
            "embryonResultArea"
        );

    const resultTitle =
        document.getElementById(
            "embryonResultTitle"
        );

    const resultPet =
        document.getElementById(
            "embryonResultPet"
        );

    guessArea.classList.add(
        "hidden"
    );

    resultArea.classList.remove(
        "hidden"
    );

    if(
        selectedNumber ===
        embryonDiceNumber
    ){

        /*
         * 🎉 PLAYER CAUGHT EMBRYON
         */

        const mutation =
            rollEmbryonMutation();

        const finalPet =
            mutation + "Embryon";

        inventory[finalPet] =
            (inventory[finalPet] || 0) + 1;

        discovered.add(
            finalPet
        );

        // 🌎 GLOBAL SECRET HATCH
        broadcastGlobalHatch(
            finalPet,
            "Secret"
        );

        dialogue.textContent =
            "You found me...";

        resultTitle.textContent =
            "🏆 EMBRYON CAUGHT!";

        resultPet.innerHTML = `
            <div style="
                font-size:60px;
                margin-bottom:15px;
            ">
                ${emojiForPet(finalPet)}
            </div>

            <div>
                ${colourPetName(finalPet)}
            </div>
        `;

        showNotification(
            "🏆 EMBRYON CAUGHT!",
            `${colourPetName(finalPet)} has been added to your pets!`
        );

        checkAchievements();

        updateUI();
        renderInventory();
        renderIndex();
        renderAchievements();

        save();

    }else{

        /*
         * 💨 EMBRYON ESCAPES
         */

        dialogue.textContent =
            "So close...";

        resultTitle.textContent =
            "💨 EMBRYON ESCAPED!";

        resultPet.innerHTML = `
            <div style="
                font-size:22px;
                margin-top:15px;
            ">
                You chose
                <strong>${selectedNumber}</strong>.
                <br><br>
                Embryon's number was
                <strong>${embryonDiceNumber}</strong>.
            </div>
        `;

    }

}

function hatch(){

    if(hatchLocked){
        return;
    }


    const cost =
        eggs[selectedEgg].cost;


    const maxHatchAmount =
        hatchAmountLevel + 1;

    const hatchAmount =
        Math.min(
            maxHatchAmount,
            Math.floor(coins / cost)
        );

    if(hatchAmount < 1){
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

        const isNewPet =
            !discovered.has(petName);

        discovered.add(petName);

        hatchedNames.push({
            name: petName,
            rarity: rarity,
            isNewPet: isNewPet
        });

        // 🌎 GLOBAL HATCH — rare pets only
        if(
            rarity === "Ancient" ||
            rarity === "Celestial" ||
            rarity === "Chromatic"
        ){

            broadcastGlobalHatch(
                petName,
                rarity
            );

        }
    }

    checkAchievements();

    updateUI();
    renderInventory();
    renderIndex();
    renderAchievements();
    save();

        showHatchAnimation(
        hatchAmount,
        hatchedNames
    );

}

// =========================================================
// 🌎 BROADCAST GLOBAL HATCH
// =========================================================

async function broadcastGlobalHatch(
    petName,
    rarity
){

    if(!currentUser){
        return;
    }

    const username =
        await getGlobalUsername();

    console.log(
        "🌎 GLOBAL USERNAME TEST:",
        username
    );

    console.log(
        "🌎 SAVED PLAYER USERNAME:",
        localStorage.getItem("playerUsername")
    );

    console.log(
        "🌎 CURRENT USER:",
        currentUser
    );

    const { error } =
        await supabaseClient
            .from("global_hatches")
            .insert({
                username: username,
                pet_name: petName,
                rarity: rarity
            });

    if(error){

        console.error(
            "Global hatch broadcast error:",
            error
        );

    }

}

function renderGlobalHatch(hatch){

    const feed =
        document.getElementById("globalHatchesFeed");

    if(!feed){
        return;
    }

    const empty =
        feed.querySelector(".global-empty");

    if(empty){
        empty.remove();
    }

    const rarity =
        String(hatch.rarity || "").toLowerCase();

    const petName =
        String(hatch.pet_name || "Unknown Pet")
            .slice(0,100);

    const username =
        String(hatch.username || "Player")
            .slice(0,30);

    let emoji = "🥚";

    if(
        petName === "Embryon" ||
        petName.endsWith("Embryon") ||
        petName === "Mystorius" ||
        petName.endsWith("Mystorius")
    ){
        emoji = "👁️";
    }else{
        emoji = emojiForPet(petName);
    }


    /* =========================================
       🌈 CHROMATIC TEST CARD
       ========================================= */

    if(rarity === "chromatic"){

        const card =
            document.createElement("div");

        card.className = "chromatic-test-card";

        card.innerHTML = `
            <div>🌎 ${escapeGlobalText(username)}</div>
            <div>${emoji} ${escapeGlobalText(username)} hatched ${escapeGlobalText(petName)}!</div>
            <div>🌈 CHROMATIC</div>
            <div>Just now</div>
        `;

        feed.appendChild(card);

        feed.scrollTop =
            feed.scrollHeight;

        return;
    }


    /* =========================================
       🥚 NORMAL HATCH
       ========================================= */

    const hatchEl =
        document.createElement("div");

    hatchEl.className =
        `global-hatch rarity-${rarity}`;

    hatchEl.innerHTML = `
        <div class="global-hatch-username">
            🌎 ${escapeGlobalText(username)}
        </div>

        <div class="global-hatch-pet">
            ${emoji}
            ${escapeGlobalText(username)}
            hatched
            ${escapeGlobalText(petName)}!
        </div>

        <div class="global-hatch-rarity">
            ${formatGlobalRarity(rarity)}
        </div>

        <div class="global-hatch-time">
            Just now
        </div>
    `;

    feed.appendChild(hatchEl);

    while(feed.children.length > 50){
        feed.firstElementChild.remove();
    }

    feed.scrollTop =
        feed.scrollHeight;
}

function formatGlobalRarity(rarity){

    if(rarity === "ancient"){
        return "🔥 ANCIENT";
    }

    if(rarity === "celestial"){
        return "✨ CELESTIAL";
    }

    if(rarity === "chromatic"){
        return "🌈 CHROMATIC";
    }

    if(rarity === "secret"){
        return "👁️ 𝚜𝚎𝚌𝚛𝚎𝚝";
    }

    return rarity.toUpperCase();

}

async function loadGlobalHatches(){

    const feed =
        document.getElementById("globalHatchesFeed");

    if(!feed){
        console.error("❌ globalHatchesFeed NOT FOUND");
        return;
    }

    if(!currentUser){
        console.log("🌎 GLOBAL HATCH LOAD: No user yet");
        return;
    }

    console.log("🌎 LOADING GLOBAL HATCHES...");

    const {
        data,
        error
    } = await supabaseClient
        .from("global_hatches")
        .select("id, username, pet_name, rarity, created_at")
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if(error){

        console.error(
            "❌ GLOBAL HATCH LOAD ERROR:",
            error
        );

        return;
    }

    console.log(
        "🌎 SAVED GLOBAL HATCHES:",
        data
    );

    /*
     * Clear the existing feed once.
     * Then rebuild it from the database.
     */
    feed.innerHTML = "";

    if(!data || data.length === 0){

        feed.innerHTML = `
            <div class="global-empty">
                🌎 No global hatches yet...
            </div>
        `;

        return;
    }

    /*
     * Database is newest → oldest.
     * Render oldest → newest so the feed
     * keeps the newest hatch at the bottom.
     */
    [...data]
        .reverse()
        .forEach(hatch => {

            const hatchEl =
                document.createElement("div");

            const rarity =
                String(hatch.rarity || "").toLowerCase();

            const petName =
                String(hatch.pet_name || "Unknown Pet")
                    .slice(0,100);

            const username =
                String(hatch.username || "Player")
                    .slice(0,30);

            let emoji = "🥚";

            if(
                petName === "Embryon" ||
                petName.endsWith("Embryon") ||
                petName === "Mystorius" ||
                petName.endsWith("Mystorius")
            ){
                emoji = "👁️";
            }else{
                emoji = emojiForPet(petName);
            }

            hatchEl.className =
                `global-hatch rarity-${rarity}`;

            hatchEl.innerHTML = `
                <div class="global-hatch-username">
                    🌎 ${escapeGlobalText(username)}
                </div>

                <div class="global-hatch-pet">
                    ${emoji}
                    ${escapeGlobalText(username)}
                    hatched
                    ${escapeGlobalText(petName)}!
                </div>

                <div class="global-hatch-rarity">
                    ${formatGlobalRarity(rarity)}
                </div>

                <div class="global-hatch-time">
                    Just now
                </div>
            `;

            feed.appendChild(hatchEl);
        });

    feed.scrollTop = feed.scrollHeight;

    console.log(
        "✅ GLOBAL HATCHES RESTORED:",
        feed.children.length
    );
}

function startEmbryonEvent(){

    if(embryonEventActive){
        return;
    }

    embryonEventActive = true;
    embryonEventLocked = true;

    const overlay =
        document.getElementById(
            "embryonEventOverlay"
        );

    const dialogue =
        document.getElementById(
            "embryonDialogue"
        );

    const diceArea =
        document.getElementById(
            "embryonDiceArea"
        );

    const guessArea =
        document.getElementById(
            "embryonGuessArea"
        );

    const resultArea =
        document.getElementById(
            "embryonResultArea"
        );

    const dice =
        document.getElementById(
            "embryonDice"
        );

    const diceText =
        document.getElementById(
            "embryonDiceText"
        );

    overlay.classList.remove("hidden");

    diceArea.classList.remove("hidden");
    guessArea.classList.add("hidden");
    resultArea.classList.add("hidden");

    dialogue.textContent =
        "You have been chosen...";

    dice.textContent = "?";

    diceText.textContent =
        "Embryon is watching you...";

    setTimeout(() => {

        dialogue.textContent =
            "Very few ever encounter me.";

    }, 1800);

    setTimeout(() => {

        dialogue.textContent =
            "Let fate decide your destiny.";

    }, 3600);

    setTimeout(() => {

        rollEmbryonDice();

    }, 5400);

}

// =========================================================
// 🌎 GLOBAL PANEL FUNCTIONS
// =========================================================

function setupGlobalPanel(){

    const hatchesTab =
        document.getElementById("globalHatchesTab");

    const chatTab =
        document.getElementById("globalChatTab");

    const hatchesFeed =
        document.getElementById("globalHatchesFeed");

    const chatFeed =
        document.getElementById("globalChatFeed");

    const chatInputArea =
        document.getElementById("globalChatInputArea");

    if(!hatchesTab || !chatTab){
        return;
    }

    hatchesTab.addEventListener("click", () => {

        hatchesTab.classList.add("active");
        chatTab.classList.remove("active");

        hatchesFeed.classList.remove("hidden");
        chatFeed.classList.add("hidden");

        chatInputArea.classList.add("hidden");

    });

    chatTab.addEventListener("click", () => {

        chatTab.classList.add("active");
        hatchesTab.classList.remove("active");

        chatFeed.classList.remove("hidden");
        hatchesFeed.classList.add("hidden");

        chatInputArea.classList.remove("hidden");

        // 📜 START CHAT AT THE BOTTOM
        requestAnimationFrame(() => {

            chatFeed.scrollTop =
                chatFeed.scrollHeight;

            requestAnimationFrame(() => {

                chatFeed.scrollTop =
                    chatFeed.scrollHeight;

            });

        });

        setTimeout(() => {

            document
                .getElementById("globalChatInput")
                ?.focus();

        }, 50);

    });

    const sendButton =
        document.getElementById("globalChatSend");

    const chatInput =
        document.getElementById("globalChatInput");

    if(sendButton && chatInput){

        sendButton.addEventListener(
            "click",
            sendGlobalChat
        );

        chatInput.addEventListener(
            "keydown",
            event => {

                if(event.key === "Enter"){

                    event.preventDefault();

                    sendGlobalChat();

                }

            }
        );

    }

}

// =========================================================
// 🖱️ DRAGGABLE GLOBAL PANEL
// =========================================================

function setupGlobalPanelDrag(){

    const panel =
        document.getElementById("globalPanel");

    if(!panel){
        console.warn("Global panel not found.");
        return;
    }

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    panel.addEventListener("pointerdown", function(event){

        // Don't drag when interacting with chat/buttons
        if(
            event.target.closest("button") ||
            event.target.closest("input") ||
            event.target.closest(".global-feed")
        ){
            return;
        }

        const rect =
            panel.getBoundingClientRect();

        dragging = true;

        offsetX =
            event.clientX - rect.left;

        offsetY =
            event.clientY - rect.top;

        // 🔥 FORCE the panel into movable coordinates
        panel.style.setProperty(
            "left",
            rect.left + "px",
            "important"
        );

        panel.style.setProperty(
            "top",
            rect.top + "px",
            "important"
        );

        panel.style.setProperty(
            "right",
            "auto",
            "important"
        );

        panel.style.setProperty(
            "bottom",
            "auto",
            "important"
        );

        panel.setPointerCapture(
            event.pointerId
        );

        event.preventDefault();

    });

    panel.addEventListener("pointermove", function(event){

        if(!dragging){
            return;
        }

        let newLeft =
            event.clientX - offsetX;

        let newTop =
            event.clientY - offsetY;

        const maxLeft =
            window.innerWidth -
            panel.offsetWidth;

        const maxTop =
            window.innerHeight -
            panel.offsetHeight;

        newLeft =
            Math.max(
                0,
                Math.min(
                    newLeft,
                    Math.max(0,maxLeft)
                )
            );

        newTop =
            Math.max(
                0,
                Math.min(
                    newTop,
                    Math.max(0,maxTop)
                )
            );

        panel.style.setProperty(
            "left",
            newLeft + "px",
            "important"
        );

        panel.style.setProperty(
            "top",
            newTop + "px",
            "important"
        );

    });

    function stopDragging(event){

        if(!dragging){
            return;
        }

        dragging = false;

        try{
            panel.releasePointerCapture(
                event.pointerId
            );
        }catch(error){}

    }

    panel.addEventListener(
        "pointerup",
        stopDragging
    );

    panel.addEventListener(
        "pointercancel",
        stopDragging
    );

}

async function sendGlobalChat(){

    if(globalChatCooldown){
        showNotification(
            "⏳ Slow Down",
            "Please wait a moment before sending another message."
        );
        return;
    }

    const input =
        document.getElementById("globalChatInput");

    if(!input){
        return;
    }

    const message =
        input.value.trim().slice(0,100);

    if(!message){
        return;
    }

    if(!currentUser){

        showNotification(
            "🔒 Login Required",
            "You must be logged in to use Global Chat."
        );

        return;
    }

    globalChatCooldown = true;

    setTimeout(() => {
        globalChatCooldown = false;
    }, GLOBAL_CHAT_COOLDOWN);

    const username =
        getGlobalUsername();

    const { error } =
        await supabaseClient
            .from("global_chat")
            .insert({
                username: username,
                message: message
            });

    if(error){

        console.error(
            "Global chat error:",
            error
        );

        showNotification(
            "❌ Chat Error",
            "Could not send your message."
        );

        return;
    }

    input.value = "";

}

function renderGlobalChat(message){

    const feed =
        document.getElementById("globalChatFeed");

    if(!feed){
        return;
    }

    const empty =
        feed.querySelector(".global-empty");

    if(empty){
        empty.remove();
    }

    const messageEl =
        document.createElement("div");

    messageEl.className =
        "global-chat-message";

    const username =
        String(message.username || "Player")
            .slice(0,30);

    const text =
        String(message.message || "")
            .slice(0,100);

    messageEl.innerHTML = `
        <div class="global-chat-username">
            ${escapeGlobalText(username)}
        </div>

        <div class="global-chat-text">
            ${escapeGlobalText(text)}
        </div>
    `;

    feed.appendChild(messageEl);

    while(feed.children.length > 100){
        feed.firstElementChild.remove();
    }

    // 📜 ALWAYS SCROLL TO NEWEST MESSAGE
    requestAnimationFrame(() => {

        feed.scrollTo({
            top: feed.scrollHeight,
            behavior: "smooth"
        });

    });

}

function escapeGlobalText(text){

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}

async function loadGlobalChat(){

    if(!currentUser){
        return;
    }

    const { data, error } =
        await supabaseClient
            .from("global_chat")
            .select("*")
            .order("created_at", {
                ascending:true
            })
            .limit(100);

    if(error){

        console.error(
            "Global chat load error:",
            error
        );

        return;
    }

    const feed =
        document.getElementById(
            "globalChatFeed"
        );

    if(!feed){
        return;
    }

    // Clear old messages
    feed.innerHTML = "";

    // Add all messages
    data.forEach(message => {

        const messageEl =
            document.createElement("div");

        messageEl.className =
            "global-chat-message";

        const username =
            String(
                message.username || "Player"
            ).slice(0,30);

        const text =
            String(
                message.message || ""
            ).slice(0,100);

        messageEl.innerHTML = `
            <div class="global-chat-username">
                ${escapeGlobalText(username)}
            </div>

            <div class="global-chat-text">
                ${escapeGlobalText(text)}
            </div>
        `;

        feed.appendChild(messageEl);

    });

    // 📜 FORCE CHAT TO START AT THE BOTTOM
    feed.scrollTop =
        feed.scrollHeight;

    // Force it again after browser layout
    requestAnimationFrame(() => {

        feed.scrollTop =
            feed.scrollHeight;

        requestAnimationFrame(() => {

            feed.scrollTop =
                feed.scrollHeight;

        });

    });

}

// =========================================================
// 🌎 GLOBAL REALTIME — LIVE HATCHES + CHAT
// =========================================================

let globalChatChannel = null;
let globalHatchesChannel = null;

let globalRealtimeChannel = null;

// =========================================================
// 🌎 GLOBAL REALTIME — CHAT + HATCHES
// =========================================================

function setupGlobalRealtime(){

    if(!currentUser){

        console.warn(
            "🌎 Global Realtime: No logged-in user."
        );

        return;
    }


    // Remove old channel if one exists

    if(globalRealtimeChannel){

        supabaseClient.removeChannel(
            globalRealtimeChannel
        );

        globalRealtimeChannel = null;
    }


    console.log(
        "🌎 Starting Global Realtime..."
    );


    globalRealtimeChannel =
        supabaseClient
            .channel(
                "global-live-" +
                currentUser.id
            )


            // =================================================
            // 💬 GLOBAL CHAT
            // =================================================

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "global_chat"
                },
                payload => {

                    console.log(
                        "💬 LIVE CHAT RECEIVED:",
                        payload.new
                    );

                    renderGlobalChat(
                        payload.new
                    );

                }
            )


            // =================================================
            // 🥚 GLOBAL HATCHES
            // =================================================

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "global_hatches"
                },
                payload => {

                    console.log(
                        "🥚 LIVE HATCH RECEIVED:",
                        payload.new
                    );

                    renderGlobalHatch(
                        payload.new
                    );

                }
            )


            // =================================================
            // 🔌 CONNECT
            // =================================================

            .subscribe(status => {

                console.log(
                    "🌎 GLOBAL REALTIME STATUS:",
                    status
                );

            });

}

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
        "Sung Jin Woo",
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
        "Sung Jin Woo": "Obtain Sung Jin Woo",
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

/* =====================================================
   📦 MYSTERY BOX OPENING ANIMATION
===================================================== */

let mysteryBoxOpening = false;


function showMysteryBoxOpening(
    rewardName,
    rewardRarity
){

    if(mysteryBoxOpening){
        return;
    }

    mysteryBoxOpening = true;

    const overlay =
        document.getElementById(
            "mysteryBoxOverlay"
        );

    const container =
        document.getElementById(
            "mysteryBoxContainer"
        );

    const box =
        document.getElementById(
            "mysteryBox"
        );

    const status =
        document.getElementById(
            "mysteryBoxStatus"
        );

    const reward =
        document.getElementById(
            "mysteryBoxReward"
        );

    const title =
        document.getElementById(
            "mysteryBoxTitle"
        );


    overlay.classList.remove(
        "hidden",
        "fading-out"
    );

    container.classList.remove(
        "shaking",
        "opening"
    );

    reward.classList.add(
        "hidden"
    );

    reward.classList.remove(
        "reward-fade"
    );

    box.textContent = "📦";

    title.textContent =
        "📦 MYSTERY BOX";


    status.textContent =
        "Something is inside...";



    /* =========================
       STEP 1 — SHAKE
    ========================= */

    setTimeout(() => {

        status.textContent =
            "👀 What's inside?!";

        container.classList.add(
            "shaking"
        );

    }, 800);



    /* =========================
       STEP 2 — MORE INTENSE
    ========================= */

    setTimeout(() => {

        status.textContent =
            "⚡ IT'S ABOUT TO OPEN!";

    }, 2200);



    /* =========================
       STEP 3 — OPEN
    ========================= */

    setTimeout(() => {

        container.classList.remove(
            "shaking"
        );

        container.classList.add(
            "opening"
        );

        status.textContent =
            "✨ REVEALING...";

    }, 3200);



    /* =========================
       STEP 4 — REWARD
    ========================= */

    setTimeout(() => {

        reward.innerHTML = `

            <div class="mystery-reward-emoji">
                ${emojiForPet(rewardName)}
            </div>

            <div class="mystery-reward-name">
                ${colourPetName(rewardName)}
            </div>

            <div class="mystery-reward-rarity">
                ${formatRarity(rewardRarity)}
            </div>

        `;

        reward.classList.remove(
            "hidden"
        );

        status.textContent =
            "🎉 REWARD FOUND!";

    }, 4100);



    /* =========================
       STEP 5 — FADE REWARD
    ========================= */

    setTimeout(() => {

        reward.classList.add(
            "reward-fade"
        );

    }, 7000);



    /* =========================
       STEP 6 — CLOSE
    ========================= */

    setTimeout(() => {

        overlay.classList.add(
            "fading-out"
        );

    }, 8200);


    setTimeout(() => {

        overlay.classList.add(
            "hidden"
        );

        overlay.classList.remove(
            "fading-out"
        );

        container.classList.remove(
            "opening",
            "shaking"
        );

        reward.classList.add(
            "hidden"
        );

        reward.classList.remove(
            "reward-fade"
        );

        mysteryBoxOpening = false;

    }, 8800);

}

function pickPet(egg){

    const pets = eggs[egg].pets;

    let luckMultiplier =
        Math.max(
            1,
            Number(luckLevel) || 1
        );

    // 🍀 Lucky Boost
    if(luckyBoostActive){

        if(Date.now() < luckyBoostEndTime){

            luckMultiplier *= 2;

        }else{

            luckyBoostActive = false;
            luckyBoostEndTime = 0;

        }
    }

    let totalWeight = 0;

    const maxIndex =
        Math.max(
            pets.length - 1,
            1
        );

    // ⚡ Apply Luck to rarer pets
    for(let i = 0; i < pets.length; i++){

        const rarityPosition =
            i / maxIndex;

        const rarityBoost =
            Math.pow(
                luckMultiplier,
                rarityPosition
            );

        totalWeight +=
            pets[i][3] * rarityBoost;
    }

    // 🎲 Roll
    let roll =
        Math.random() * totalWeight;

    for(let i = 0; i < pets.length; i++){

        const rarityPosition =
            i / maxIndex;

        const rarityBoost =
            Math.pow(
                luckMultiplier,
                rarityPosition
            );

        roll -=
            pets[i][3] * rarityBoost;

        if(roll < 0){

            return pets[i];

        }
    }

    return pets[0];
}

function showHatchAnimation(hatchAmount, hatchedNames){

    const overlay =
        document.getElementById("hatchAnimationOverlay");

    const eggsContainer =
        document.getElementById("hatchAnimationEggs");

    const hatchButton =
        document.getElementById("hatchButton");

    if(!overlay || !eggsContainer){

        hatchLocked = false;

        if(hatchButton){
            hatchButton.disabled = false;
        }

        return;
    }


    /* =========================
       CLEAR OLD ANIMATION
    ========================= */

    eggsContainer.innerHTML = "";

    overlay.classList.remove("hidden");
    overlay.classList.remove("fading-out");


    /* =========================
       HATCH TIMES
    ========================= */

    let longestDelay = 0;


    /* =========================
       CREATE EGGS
    ========================= */

    for(let i = 0; i < hatchAmount; i++){

        const data = hatchedNames[i];

        if(!data){
            continue;
        }

        const rarity = data.rarity;

        const egg =
            document.createElement("div");

        egg.className =
            "hatch-animation-egg shaking";


        /* Rarity effects */

        if(rarity === "Ancient"){

            egg.classList.add(
                "hatch-rarity-ancient",
                "ancient-hatch-tension"
            );

        }

        if(rarity === "Celestial"){

            egg.classList.add(
                "hatch-rarity-celestial",
                "celestial-hatch-tension"
            );

        }

        if(rarity === "Chromatic"){

            egg.classList.add(
                "hatch-rarity-chromatic",
                "chromatic-hatch-tension"
            );

        }


        egg.innerHTML = `
            <div class="hatch-egg-aura"></div>

            <div class="hatch-egg-energy"></div>

            <div class="hatch-egg-emoji">
                🥚
            </div>
        `;

        eggsContainer.appendChild(egg);


        /* =========================
           HATCH TIME
        ========================= */

        let delay;

        if(rarity === "Ancient"){

            delay = 4000;

        }
        else if(rarity === "Celestial"){

            delay = 6000;

        }
        else if(rarity === "Chromatic"){

            delay = 8000;

        }
        else{

            delay = getFasterHatchTime();

        }


        if(delay > longestDelay){

            longestDelay = delay;

        }


        /* =========================
           CRACK EGG
        ========================= */

        setTimeout(() => {

            if(!egg.isConnected){
                return;
            }

            egg.classList.remove(
                "shaking"
            );

            egg.classList.add(
                "cracking"
            );

        }, delay);


        /* =========================
           REVEAL REWARD
        ========================= */

        setTimeout(() => {

            if(!egg.isConnected){
                return;
            }

            const fullResult =
                data.name;

            egg.classList.remove(
                "cracking"
            );

            egg.classList.add(
                "hatch-result-revealed"
            );

            egg.innerHTML = `
                <div class="
                    hatch-animation-result
                    mutation-card
                    mutation-card-${getMutationClass(fullResult)}
                ">

                    <div class="
                        mutation-particles
                        mutation-particles-${getMutationClass(fullResult)}
                    "></div>

                    <div class="
                        hatch-result-emoji
                        mutation-pet-emoji
                        mutation-pet-${getMutationClass(fullResult)}
                    ">
                        ${emojiForPet(fullResult)}
                    </div>

                    <div class="
                        hatch-result-name
                        mutation-result
                        mutation-${getMutationClass(fullResult)}
                    ">
                        ${colourPetName(fullResult)}
                    </div>

                    <div class="
                        hatch-result-rarity
                        rarity-${data.rarity.toLowerCase()}
                    ">
                        ${formatRarity(data.rarity)}
                    </div>

                </div>
            `;

        }, delay + 600);

    }


    /* =========================
       REWARD FADE
    ========================= */

    const rewardFadeTime =
        Math.max(
            500,
            1500 - (fasterHatchLevel * 200)
        );

    overlay.style.setProperty(
        "--reward-fade-time",
        `${rewardFadeTime}ms`
    );


    /*
       Wait until the slowest egg
       has revealed its reward.
    */

    const totalAnimationTime =
        longestDelay + 1200;


    setTimeout(() => {

        const results =
            eggsContainer.querySelectorAll(
                ".hatch-animation-result"
            );


        /* =========================
           FADE REWARDS
        ========================= */

        results.forEach((result, index) => {

            setTimeout(() => {

                result.classList.add(
                    "reward-fading"
                );

            }, index * 100);

        });


        /*
           Wait until the LAST reward
           has completely disappeared.
        */

        const unlockDelay =
            rewardFadeTime +
            ((results.length - 1) * 100);


        setTimeout(() => {


            /* =========================
               HIDE HATCH OVERLAY
            ========================= */

            overlay.classList.add(
                "fading-out"
            );


            /*
               Give the overlay time to
               visually fade away.
            */

            setTimeout(() => {

                overlay.classList.add(
                    "hidden"
                );

                overlay.classList.remove(
                    "fading-out"
                );

                eggsContainer.innerHTML = "";


                /* =========================
                   🔓 UNLOCK HATCHING
                ========================= */

                hatchLocked = false;

                if(hatchButton){

                    hatchButton.disabled = false;

                }


                /* =========================
                   👁️ EMBRYON CHECK
                ========================= */

                if(
                    shouldTriggerEmbryonEvent()
                ){

                    startEmbryonEvent();

                }

            }, 300);

        }, unlockDelay);

    }, totalAnimationTime);

}



function getMutationClass(pet){

    if(pet.startsWith("Shiny Dark Matter ")){
        return "shiny-dark-matter";
    }

    if(pet.startsWith("Shiny Rainbow ")){
        return "shiny-rainbow";
    }

    if(pet.startsWith("Shiny Golden ")){
        return "shiny-golden";
    }

    if(pet.startsWith("Shiny Superior ")){
        return "shiny-superior";
    }

    if(pet.startsWith("Dark Matter ")){
        return "dark-matter";
    }

    if(pet.startsWith("Rainbow ")){
        return "rainbow";
    }

    if(pet.startsWith("Golden ")){
        return "golden";
    }

    if(pet.startsWith("Superior ")){
        return "superior";
    }

    if(pet.startsWith("Shiny ")){
        return "shiny";
    }

    return "normal";
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

    // Luck
    const cost =
        getUpgradeCost(50, luckLevel);

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    luckLevel += 1;

    resultEl.textContent =
        `🎉 Luck upgraded to ${Number(luckLevel).toFixed(1)}x!`

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

    const panel =
        document.getElementById("autoRebirthPanel");

    panel
        .classList
        .remove("hidden");

    updateRebirthButtons();
}


function toggleAutoRebirth(){

    if(!autoRebirthPurchased){

        showNotification(
            "🔒 Locked",
            "Purchase Auto-Rebirth first."
        );

        return;
    }

    autoRebirthEnabled = !autoRebirthEnabled;

    // Make absolutely sure the watcher is running
    if(!autoRebirthInterval){
        startAutoRebirth();
    }

    updateUI();
    save();

    // If we can already afford it, check immediately
    if(autoRebirthEnabled){
        runAutoRebirthCheck();
    }

    showNotification(
        autoRebirthEnabled
            ? "🟢 Auto-Rebirth ON"
            : "🔴 Auto-Rebirth OFF",

        autoRebirthEnabled
            ? `Automatically rebirthing ×${autoRebirthTarget} whenever affordable.`
            : "Auto-Rebirth has been disabled."
    );
}

function rebirth(){
    rebirthMultiple(1);
}


// =========================
// AUTO REBIRTH
// =========================

let autoRebirthInterval = null;

function rebirth(){
    rebirthMultiple(1);
}

function runAutoRebirthCheck(){

    if(!autoRebirthPurchased){
        return;
    }

    if(!autoRebirthEnabled){
        return;
    }

    // How many rebirths to perform each time
    const target = Math.max(
        1,
        Number(autoRebirthTarget) || 1
    );

    // Calculate the total cost for the selected amount
    let totalCost = 0;
    let tempCost = Number(rebirthCost) || 100;

    for(let i = 0; i < target; i++){

        totalCost += tempCost;

        tempCost = Math.min(
            tempCost * 1.5,
            Number.MAX_VALUE
        );
    }

    // Not enough coins yet — keep waiting
    if(Number(coins) < totalCost){
        return;
    }

    console.log(
        "🤖 AUTO REBIRTH:",
        `×${target}`,
        "Cost:",
        totalCost,
        "Coins:",
        coins
    );

    // Perform the rebirth
    rebirthMultiple(target);

    // IMPORTANT:
    // Do NOT turn Auto-Rebirth off.
    // It stays ON and waits for the next affordable rebirth.
}


function startAutoRebirth(){

    // Make sure there is only ONE watcher
    if(autoRebirthInterval){
        clearInterval(autoRebirthInterval);
        autoRebirthInterval = null;
    }

    autoRebirthInterval = setInterval(() => {

        runAutoRebirthCheck();

    }, 250);
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

    // More Rebirths
    const cost =
        getUpgradeCost(10, rebirthUpgradeLevel);

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

    const autoContainer =
        document.getElementById("autoRebirthOptions");

    container.innerHTML = "";
    autoContainer.innerHTML = "";


    /*
     * COST CALCULATOR
     *
     * Each rebirth amount uses 1.5x
     * progression from the previous rebirth.
     *
     * ×1 = current rebirth cost
     * ×2 = current cost × 1.5
     * ×5 = current cost × 1.5^4
     * ×10 = current cost × 1.5^9
     */

    function getRebirthCost(amount){

        let totalCost = 0;
        let tempCost = rebirthCost;

        for(let i = 0; i < amount; i++){

            if(
                tempCost >= Number.MAX_VALUE ||
                totalCost >= Number.MAX_VALUE - tempCost
            ){
                return Number.MAX_VALUE;
            }

            totalCost += tempCost;

            tempCost =
                Math.min(
                    tempCost * 1.5,
                    Number.MAX_VALUE
                );
        }

        return totalCost;
    }


    /*
     * CREATE REBIRTH BUTTON
     */

    function createRebirthButton(amount){

        const button =
            document.createElement("button");

        button.className =
            "hatch-button rebirth-choice-button";

        if(amount === 100){
            button.style.gridColumn = "1 / -1";
            button.style.justifySelf = "center";
        }

        button.innerHTML = `
            <span>
                🔄 REBIRTH ×${formatRebirthAmount(amount)}
            </span>

            <small>
                💰 Cost: ${formatCoins(
                    getRebirthCost(amount)
                )} coins
            </small>
        `;

        button.addEventListener(
            "click",
            () => {

                selectedRebirthAmount =
                    amount;

                rebirthMultiple(amount);

            }
        );

        return button;
    }


    /*
     * REBIRTH ×1
     */

    container.appendChild(
        createRebirthButton(1)
    );


    /*
     * MORE REBIRTH BUTTONS
     */

    for(
        let level = 1;
        level <= rebirthUpgradeLevel;
        level++
    ){

        const amount =
            rebirthUpgradeAmounts[level];

        if(amount === undefined){
            continue;
        }

        container.appendChild(
            createRebirthButton(amount)
        );

    }


    /*
     * AUTO-REBIRTH
     *
     * ×1 is ALWAYS available.
     */

    function createAutoRebirthOption(amount){

        const option =
            document.createElement("div");

        option.className =
            "auto-rebirth-option";

        option.innerHTML = `
            <div class="auto-rebirth-option-name">
                🔄 Rebirth ×${formatRebirthAmount(amount)}
            </div>

            <div class="auto-rebirth-cost">
                💰 Cost:
                <strong>
                    ${formatCoins(
                        getRebirthCost(amount)
                    )}
                </strong>
                coins
            </div>

            <button
                class="auto-rebirth-select-button"
            >
                SELECT
            </button>
        `;

        option
            .querySelector("button")
            .addEventListener(
                "click",
                () => {

                    autoRebirthTarget =
                        amount;

                    document
                        .getElementById(
                            "autoRebirthPanel"
                        )
                        .classList
                        .add("hidden");

                    updateUpgradeUI();
                    save();

                }
            );

        return option;
    }


    /*
     * AUTO ×1
     */

    autoContainer.appendChild(
        createAutoRebirthOption(1)
    );


    /*
     * AUTO MORE OPTIONS
     */

    for(
        let level = 1;
        level <= rebirthUpgradeLevel;
        level++
    ){

        const amount =
            rebirthUpgradeAmounts[level];

        if(amount === undefined){
            continue;
        }

        autoContainer.appendChild(
            createAutoRebirthOption(amount)
        );

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
                tempCost * 1.5,
                Number.MAX_VALUE
            );
    }

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

    /*
     * The next rebirth starts after
     * every rebirth included in this purchase.
     */
    rebirthCost = tempCost;

    /*
     * Every rebirth gives +1x click power.
     */
    clickPower = rebirths + 1;

    document.getElementById("rebirthResult").textContent =
        `🎉 REBIRTH ×${formatRebirthAmount(amount)}! +${formatCoins(amount * 10)} 💎 gems`;

    showNotification(
        "🔄 Rebirth!",
        `You rebirthed ×${formatRebirthAmount(amount)}!`
    );

    updateUI();

    updateRebirthButtons();

    save();
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

    // Click Speed
    const cost =
        getUpgradeCost(50, clickSpeedLevel);

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

    const cost =
        getUpgradeCost(
            10,
            multiplierLevel
        );

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

    // Hatch Amount
    const cost =
        getUpgradeCost(100, hatchAmountLevel);

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

    const clickButton = document.getElementById("clickButton");

    clickButton.classList.remove("clicking");

    void clickButton.offsetWidth;

    clickButton.classList.add("clicking");

    setTimeout(() => {
        clickButton.classList.remove("clicking");
    }, 90);

    if(clickLocked){
        return;
    }

    clickLocked = true;

    totalClicks++;

    
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

// 💥 CRIT CHANCE
const isCrit = Math.random() < critChance;

    let earned =
        clickPower *
        petMultiplier *
        clickMultiplier *
        skinMultiplier *
        boostMultiplier;

    if(isCrit){
        earned *= critMultiplier;

        showCritEffect(earned);
    }

    coins += earned;

const levelUps = [];

for(const pet of equippedPets){

    const beforeLevel =
        getPetLevelData(pet).level;

    addPetExp(
        pet,
        10
    );

    const afterLevel =
        getPetLevelData(pet).level;

    if(afterLevel > beforeLevel){

        levelUps.push({
            petName: pet,
            level: afterLevel
        });

    }
}

if(levelUps.length > 0){

    showPetLevelUpEffect(
        levelUps
    );
}

if(equippedPets.length > 0){

    renderInventory();
    renderIndex();

}

    const clickButtonRect =
        clickButton.getBoundingClientRect();

    const coinFloat =
        document.createElement("div");

    coinFloat.className = "coin-float";

    coinFloat.textContent =
        "+" + formatCoins(earned) + " 💰";

    coinFloat.style.left =
        (clickButtonRect.left + clickButtonRect.width / 2) + "px";

    coinFloat.style.top =
        (clickButtonRect.top + 10) + "px";

    document.body.appendChild(coinFloat);

    setTimeout(() => {
        coinFloat.remove();
    }, 800);


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

function showCritEffect(amount){

    const effect = document.createElement("div");

    effect.className = "crit-effect";

    effect.innerHTML = `
        <div class="crit-burst">💥</div>
        <div class="crit-text">CRITICAL!</div>
        <div class="crit-coins">+${formatCoins(amount)} 🪙</div>
    `;

    document.body.appendChild(effect);

    setTimeout(() => {
        effect.remove();
    }, 1000);
}

function showPetLevelUpEffect(levelUps){

    if(!Array.isArray(levelUps) || levelUps.length === 0){
        return;
    }

    const effect =
        document.createElement("div");

    effect.className =
        "pet-level-up-effect";

    const petList =
        levelUps.map(up => `
            <div class="pet-level-up-pet">
                <div class="pet-level-up-pet-emoji">
                    ${emojiForPet(up.petName)}
                </div>

                <div class="pet-level-up-pet-name">
                    ${colourPetName(up.petName)}
                </div>

                <div class="pet-level-up-pet-level">
                    LEVEL ${up.level}
                </div>
            </div>
        `).join("");

    effect.innerHTML = `
        <div class="pet-level-up-rays">
            ✨ ✦ ✨
        </div>

        <div class="pet-level-up-burst">
            🐾
        </div>

        <div class="pet-level-up-title">
            ${levelUps.length === 1
                ? "PET LEVEL UP!"
                : "PETS LEVEL UP!"}
        </div>

        <div class="pet-level-up-pets">
            ${petList}
        </div>
    `;

    document.body.appendChild(effect);

    setTimeout(() => {
        effect.remove();
    }, 1800);
}

function renderIndex(){

    const sections =
        document.getElementById("indexSections");

    const all =
        allIndexPets();


    sections.innerHTML =
        all.map(([section,pets]) => {

            return `

                <div class="index-section">

                    <h3>
                        ${section}
                    </h3>


                    <div class="index-section-grid">

                        ${pets.map(name => {

                            const isDiscovered =
                                discovered.has(name);


                            const rarity =
                                getPetRarity(name);


                            /* =========================
                               DISCOVERED PET
                            ========================= */

                            if(isDiscovered){

                                const secretClass =
                                    rarity === "Secret"
                                        ? " secret-pet-card"
                                        : "";


                                const secretRarityClass =
                                    rarity === "Secret"
                                        ? " secret-pet-rarity"
                                        : "";


                                return `

                                    <div class="
                                        index-card
                                        discovered
                                        ${secretClass}
                                    ">

                                        <div class="emoji">
                                            ${emojiForPet(name)}
                                        </div>


                                        <div class="index-pet-name">
                                            ${colourPetName(name)}
                                        </div>


                                        <div class="
                                            index-pet-rarity
                                            rarity-${rarity.toLowerCase()}
                                            ${secretRarityClass}
                                        ">
                                            ${formatRarity(rarity)}
                                        </div>


                                        <div class="index-discovered">
                                            ✓ DISCOVERED
                                        </div>

                                    </div>

                                `;

                            }


                            /* =========================
                               LOCKED PET
                            ========================= */

                            return `

                                <div class="index-card locked">

                                    <div class="emoji">
                                        ❓
                                    </div>


                                    <div class="index-pet-name">
                                        ???
                                    </div>


                                    <div class="index-pet-rarity">
                                        ???
                                    </div>


                                    <div class="index-undiscovered">
                                        🔒 NOT DISCOVERED
                                    </div>

                                </div>

                            `;

                        }).join("")}

                    </div>

                </div>

            `;

        }).join("");


    document.getElementById("indexCount").textContent =
        `${discovered.size} / 246 discovered`;


    document.getElementById("indexProgress").style.width =
        `${Math.min(
            discovered.size / 246 * 100,
            100
        )}%`;

}

function emojiForPet(name){
    const stripped=name.replace(/^(Shiny Dark Matter |Dark Matter |Shiny Golden |Shiny Rainbow |Shiny Superior |Shiny |Golden |Rainbow |Superior )/,"");
    const p=findPetData(stripped);
    if(p) return p[1];
    if(stripped==="Embryon") return "👁️";
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
                <div class="equipped-slot">

                    <div class="emoji">🐾</div>

                    <strong>Empty slot</strong>

                    <small>Equip a pet here</small>

                </div>
            `;

            continue;
        }


        const petLevelData = getPetLevelData(pet);

const petLevel =
    Math.max(
        1,
        Math.min(
            MAX_PET_LEVEL,
            petLevelData.level || 1
        )
    );

const petExp =
    petLevelData.exp || 0;

const petExpRequired =
    getPetExpRequired(petLevel);

const isMaxLevel =
    petLevel >= MAX_PET_LEVEL;

const expPercent =
    isMaxLevel
        ? 100
        : Math.min(
            100,
            (petExp / petExpRequired) * 100
        );

        equippedBox.innerHTML += `
            <div class="equipped-slot ${
                getPetRarity(pet) === "Secret"
                    ? "secret-pet-card"
                    : ""
            } ${
                isMaxLevel
                    ? "max-level-pet"
                    : ""
            }">

                <div class="emoji">
                    ${emojiForPet(pet)}
                </div>

                <strong>
                    ${colourPetName(pet)}
                </strong>

                <div class="pet-rarity rarity-${getPetRarity(pet).toLowerCase()} ${
                    getPetRarity(pet) === "Secret"
                        ? "secret-pet-rarity"
                        : ""
                }">
                    ${formatRarity(getPetRarity(pet))}
                </div>

                <div class="pet-level-display">

                    <div class="pet-level-text">
                        👑 LEVEL ${petLevel}
                    </div>

                    <div class="pet-exp-bar">

                        <div
                            class="pet-exp-fill"
                            style="width:${expPercent}%"
                        ></div>

                    </div>

                    <div class="pet-exp-text">

                        ${
                            isMaxLevel
                                ? "MAX LEVEL"
                                : `${formatCoins(petExp)} / ${formatCoins(petExpRequired)} EXP`
                        }

                    </div>

                </div>

                <small>
                    ×${formatCoins(getPetMultiplier(pet))}
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
            <div class="pet-card ${
                getPetRarity(name) === "Secret"
                    ? "secret-pet-card"
                    : ""
            }">
 
                <div class="emoji"> 
                    ${emojiForPet(name)} 
                </div> 
 
                <strong>${colourPetName(name)}</strong>

                <div class="pet-rarity rarity-${getPetRarity(name).toLowerCase()} ${
                    getPetRarity(name) === "Secret"
                        ? "secret-pet-rarity"
                        : ""
                }">
                    ${formatRarity(getPetRarity(name))}
                </div>

                <small>
                    Owned: ${formatCoins(owned)}
                    <br>
                    Equipped: ${formatCoins(equipped)}
                    · Available: ${formatCoins(available)}
                    <br>
                    ⚡ ×${formatCoins(getPetMultiplier(name))} click power
                </small> 
 
                <div class="pet-card-buttons">
                    ${button}

                    <button
                        class="delete-pet-button"
                        onclick="deletePet('${name.replace(/'/g, "\\'")}')"
                    >
                        🗑️ DELETE
                    </button>
                </div>
 
            </div> 
        `;

    }).join("");
}

function deletePet(name){

    const owned =
        inventory[name] || 0;

    if(owned <= 0){
        return;
    }

    const equipped =
        equippedPets.filter(
            pet => pet === name
        ).length;

    const available =
        owned - equipped;

    if(available <= 0){

        showNotification(
            "🔒 Pet Equipped",
            "All copies of this pet are equipped."
        );

        return;
    }


    /* =========================
       🗑️ OPEN DELETE GUI
    ========================= */

    petPendingDeletion = {
        name: name,
        owned: owned,
        equipped: equipped,
        available: available,
        deleteAmount: 1
    };


    const overlay =
        document.getElementById("deletePetOverlay");

    const preview =
        document.getElementById("deletePetPreview");

    const secretWarning =
        document.getElementById(
            "deletePetSecretWarning"
        );


    const emoji =
        emojiForPet(name);

    const rarity =
        getPetRarity(name);


    preview.innerHTML = `
        <div class="delete-pet-emoji">
            ${emoji}
        </div>

        <div class="delete-pet-name">
            ${colourPetName(name)}
        </div>

        <div style="
            font-size:13px;
            color:#aaa;
            margin-top:6px;
        ">
            ${formatCoins(available)} unequipped
            · ${formatCoins(equipped)} equipped
        </div>
    `;


    if(rarity === "Secret"){

        secretWarning.classList.remove(
            "hidden"
        );

    }else{

        secretWarning.classList.add(
            "hidden"
        );
    }

    updateDeletePetQuantity();

    overlay.classList.remove(
        "hidden"
    );
}


/* =========================
   ❌ CANCEL
========================= */

function closeDeletePetConfirm(){

    const overlay =
        document.getElementById(
            "deletePetOverlay"
        );

    overlay.classList.add(
        "hidden"
    );

    petPendingDeletion = null;
}

function formatUpgradePrice(amount){

    if(amount >= 1000000000){

        return (
            (amount / 1000000000)
                .toFixed(2)
                .replace(/\.00$/, "")
                .replace(/(\.\d)0$/, "$1")
            + "B"
        );

    }

    if(amount >= 1000000){

        return (
            (amount / 1000000)
                .toFixed(2)
                .replace(/\.00$/, "")
                .replace(/(\.\d)0$/, "$1")
            + "M"
        );

    }

    if(amount >= 1000){

        return (
            (amount / 1000)
                .toFixed(2)
                .replace(/\.00$/, "")
                .replace(/(\.\d)0$/, "$1")
            + "K"
        );

    }

    return amount.toString();

}

function getUpgradeCost(baseCost, level){

    const cost =
        baseCost * Math.pow(1.5, level);

    return Math.round(cost / 10) * 10;

}

function getFasterHatchTime(){

    const times = [
        1000, // Level 0
        867,  // Level 1
        733,  // Level 2
        600,  // Level 3
        467,  // Level 4
        333   // Level 5
    ];

    return times[
        Math.min(
            fasterHatchLevel,
            MAX_FASTER_HATCH_LEVEL
        )
    ];
}

function getFasterHatchCost(){

    const baseCost = 20;

    const cost =
        baseCost *
        Math.pow(
            1.5,
            fasterHatchLevel
        );

    return Math.round(cost / 10) * 10;
}

function upgradeFasterHatch(){

    if(
        fasterHatchLevel >=
        MAX_FASTER_HATCH_LEVEL
    ){

        resultEl.textContent =
            "⚡ Faster Egg Hatch is already MAXED!";

        showNotification(
            "⚡ Already Maxed!",
            "Faster Egg Hatch is already level 5/5."
        );

        return;
    }

    const cost =
        getFasterHatchCost();

    if(gems < cost){

        resultEl.textContent =
            `❌ You need ${formatCoins(cost - gems)} more gems!`;

        return;
    }

    gems -= cost;

    fasterHatchLevel++;

    showNotification(
        "⚡ Faster Egg Hatch Upgraded!",
        `Level ${fasterHatchLevel}/5`
    );

    updateUI();

    save();

}

function updateUpgradeUI(){

    /* ⚡ Faster Egg Hatch */

    const fasterHatchLevelEl =
        document.getElementById(
            "fasterHatchLevel"
        );

    const fasterHatchCurrentEl =
        document.getElementById(
            "fasterHatchCurrent"
        );

    const fasterHatchNextEl =
        document.getElementById(
            "fasterHatchNext"
        );

    const fasterHatchCostEl =
        document.getElementById(
            "fasterHatchCost"
        );

    const fasterHatchButton =
        document.getElementById(
            "fasterHatchUpgrade"
        );

    if(fasterHatchLevelEl){

        fasterHatchLevelEl.textContent =
            `${fasterHatchLevel} / ${MAX_FASTER_HATCH_LEVEL}`;

    }

    if(fasterHatchCurrentEl){

        fasterHatchCurrentEl.textContent =
            `${(
                getFasterHatchTime() / 1000
            ).toFixed(2)} seconds`;

    }

    if(fasterHatchNextEl){

        if(
            fasterHatchLevel >=
            MAX_FASTER_HATCH_LEVEL
        ){

            fasterHatchNextEl.textContent =
                "MAX";

        }else{

            const nextTime =
                Math.round(
                    2000 *
                    Math.pow(
                        0.8,
                        fasterHatchLevel + 1
                    )
                );

            fasterHatchNextEl.textContent =
                `${(
                    nextTime / 1000
                ).toFixed(2)} seconds`;

        }

    }

    if(fasterHatchCostEl){

        fasterHatchCostEl.textContent =
            fasterHatchLevel >=
            MAX_FASTER_HATCH_LEVEL

            ? "MAX"

            : `${formatCoins(
                getFasterHatchCost()
            )} gems`;

    }

    if(fasterHatchButton){

        fasterHatchButton.textContent =
            fasterHatchLevel >=
            MAX_FASTER_HATCH_LEVEL

            ? "MAXED"

            : "⬆️ UPGRADE";

    }

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
            : `${formatUpgradePrice(
                getUpgradeCost(50, clickSpeedLevel)
            )} gems`;


    // CLICK MULTIPLIER

    document.getElementById("multiplierLevel").textContent =
        `${multiplierLevel} / ${MAX_MULTIPLIER_LEVEL}`;

    document.getElementById("multiplierCurrent").textContent =
        `${Math.min(
            multiplierLevel,
            MAX_MULTIPLIER_LEVEL
        )}x`;

    document.getElementById("multiplierNext").textContent =
        multiplierLevel >= MAX_MULTIPLIER_LEVEL
            ? "MAX"
            : `${multiplierLevel + 2}x`;

    document.getElementById("multiplierCost").textContent =
        multiplierLevel >= MAX_MULTIPLIER_LEVEL
            ? "MAX"
            : `${formatUpgradePrice(
                getUpgradeCost(10, multiplierLevel)
            )} gems`;


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
            : `${formatUpgradePrice(
                getUpgradeCost(10, rebirthUpgradeLevel)
            )} gems`;


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
            : `${formatUpgradePrice(
                getUpgradeCost(100, hatchAmountLevel)
            )} gems`;


    // LUCK

    document.getElementById("luckLevel").textContent =
        `${luckLevel} / ${MAX_LUCK_LEVEL}`;

    document.getElementById("luckCurrent").textContent =
        `${Number(luckLevel).toFixed(1)}x`;

    document.getElementById("luckNext").textContent =
        luckLevel >= MAX_LUCK_LEVEL
            ? "MAX"
            : `${(Number(luckLevel) + 1).toFixed(1)}x`;

    document.getElementById("luckCost").textContent =
        luckLevel >= MAX_LUCK_LEVEL
            ? "MAX"
            : `${formatUpgradePrice(
                getUpgradeCost(50, luckLevel)
            )} gems`;


    // PET EQUIP

    MAX_EQUIPPED =
        getMaxEquipped();

    document.getElementById("equipCurrent").textContent =
        `${MAX_EQUIPPED} pets`;

    document.getElementById("equipNext").textContent =
        equipUpgradeLevel >= MAX_EQUIP_UPGRADE_LEVEL
            ? "MAX"
            : `${MAX_EQUIPPED + 1} pets`;

    document.getElementById("equipCost").textContent =
        equipUpgradeLevel >= MAX_EQUIP_UPGRADE_LEVEL
            ? "MAX"
            : formatUpgradePrice(
                equipUpgradeLevel === 0
                    ? 1000
                    : 5000
            ) + " gems";


        // AUTO REBIRTH

    document.getElementById("autoRebirthStatus").textContent =
        autoRebirthPurchased
            ? "PURCHASED"
            : "NOT PURCHASED";

    document.getElementById("autoRebirthCost").textContent =
        autoRebirthPurchased
            ? "OWNED"
            : "100 gems";

    document.getElementById("autoRebirthUpgrade").textContent =
        autoRebirthPurchased
            ? "OWNED"
            : "⬆️ PURCHASE";
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

document.getElementById("fasterHatchUpgrade") .addEventListener(
    "click",
    upgradeFasterHatch
);

document
    .getElementById("embryonContinueButton")
    .addEventListener(
        "click",
        closeEmbryonEvent
    );

function closeEmbryonEvent(){

    const overlay =
        document.getElementById(
            "embryonEventOverlay"
        );

    overlay.classList.add(
        "hidden"
    );

    embryonEventActive = false;
    embryonEventLocked = false;
    embryonDiceNumber = 0;

    document.getElementById(
        "embryonNumberGrid"
    ).innerHTML = "";

    // 🔓 UNLOCK HATCHING AGAIN
    hatchLocked = false;

    const hatchButton =
        document.getElementById(
            "hatchButton"
        );

    if(hatchButton){
        hatchButton.disabled = false;
    }

}

document.getElementById("selectAutoRebirthButton").addEventListener(
    "click",
    selectAutoRebirth
);

document.getElementById("toggleAutoRebirthButton").addEventListener(
    "click",
    toggleAutoRebirth
);

async function loadAdminPlayers(){

    const playerSelect =
        document.getElementById("adminPlayerSearch");

    const {
        data,
        error
    } = await supabaseClient
        .rpc("admin_get_players");

    if(error){

        console.error(
            "Admin player list error:",
            error
        );

        return;
    }

    playerSelect.innerHTML = `
        <option value="">
            SELECT PLAYER
        </option>

        <option value="ALL">
            🌎 ALL PLAYERS
        </option>
    `;

    if(!data){
        return;
    }

    data.forEach(player => {

        const option =
            document.createElement("option");

        option.value =
            player.username;

        option.textContent =
            player.username;

        playerSelect.appendChild(option);

    });

}

document
    .getElementById("adminSearchButton")
    .addEventListener("click", async () => {

        const selectedPlayer =
            document
                .getElementById("adminPlayerSearch")
                .value;

        const result =
            document
                .getElementById("adminPlayerResult");

        const controls =
            document
                .getElementById("adminControls");

        result.textContent = "";
        controls.classList.add("hidden");

        if(!selectedPlayer){

            result.textContent =
                "Select a player.";

            return;
        }

        if(selectedPlayer === "ALL"){

            adminTargetUserId = "ALL";
            adminTargetUsername = "ALL PLAYERS";

            document
                .getElementById("adminTargetName")
                .textContent =
                "Editing: ALL PLAYERS";

            result.textContent =
                "All players selected.";

            controls.classList.remove("hidden");

            return;
        }

        const {
            data,
            error
        } = await supabaseClient
            .from("usernames")
            .select("username, user_id")
            .eq("username", selectedPlayer)
            .maybeSingle();

        if(error){

            console.error(
                "Admin player error:",
                error
            );

            result.textContent =
                "Player lookup failed.";

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
            "Player selected.";

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

        const luckValue =
            document
                .getElementById("adminLuck")
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
            changes.rebirths = Number(rebirthsValue);

            if(Number(rebirthsValue) === 0){
                changes.rebirthCost = 100;
                changes.clickPower = 1;
            }
        }

        if(luckValue !== ""){

            changes.luckLevel =
                Math.max(
                    1,
                    Number(luckValue)
                );
        }

        if(Object.keys(changes).length === 0){
            alert("Enter at least one value.");
            return;
        }

        let error;

        if(adminTargetUserId === "ALL"){

            const {
                error: updateError
            } = await supabaseClient
                .rpc(
                    "admin_update_all_players",
                    {
                        changes:
                            changes
                    }
                );

            error = updateError;

        }else{

            const {
                error: updateError
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

            error = updateError;
        }

        if(error){

            console.error("ADMIN ERROR MESSAGE:", error?.message);
            console.error("ADMIN ERROR DETAILS:", error?.details);
            console.error("ADMIN ERROR HINT:", error?.hint);
            console.error("ADMIN ERROR CODE:", error?.code);

            alert(
                "Admin update failed."
            );

            return;
        }

        if(
            adminTargetUserId === "ALL" ||
            adminTargetUserId === currentUser.id
        ){

            await load();

            updateUI();

            // Make sure the Luck display updates immediately
            const luckValueEl =
                document.getElementById("luckValue");

            if(luckValueEl){

                luckValueEl.textContent =
                    Number(luckLevel).toFixed(1) + "x";
            }

            renderInventory();
            renderIndex();
            renderEggs();
            updateRebirthButtons();
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

        const resetType =
            document
                .getElementById("adminResetType")
                .value;

        const resetNames = {
            full: "entire game",
            upgrades: "upgrades",
            rebirths: "rebirths",
            shop: "shop purchases",
            upgrades_shop: "upgrades and shop purchases"
        };

        const resetName =
            resetNames[resetType] || "selected items";

        const confirmed =
            confirm(
                adminTargetUserId === "ALL"
                    ? `⚠️ RESET ${resetName.toUpperCase()} FOR EVERY PLAYER?`
                    : `Reset ${resetName} for ${adminTargetUsername}?`
            );

        if(!confirmed){
            return;
        }

        // 🔒 BLOCK ALL AUTOSAVES DURING ADMIN RESET
        adminResetInProgress = true;

        if(onlineSaveTimer){
            clearTimeout(onlineSaveTimer);
            onlineSaveTimer = null;
        }

        // Wait for an already-running save to finish
        while(onlineSaveInProgress){
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        let error = null;

        /* =========================
           RESET ALL PLAYERS
        ========================= */

        if(adminTargetUserId === "ALL"){

            if(resetType === "upgrades_shop"){

                let result =
                    await supabaseClient.rpc(
                        "admin_reset_all_players",
                        {
                            reset_type: "upgrades"
                        }
                    );

                error = result.error;

                if(!error){

                    result =
                        await supabaseClient.rpc(
                            "admin_reset_all_players",
                            {
                                reset_type: "shop"
                            }
                        );

                    error = result.error;
                }

            }else{

                const result =
                    await supabaseClient.rpc(
                        "admin_reset_all_players",
                        {
                            reset_type: resetType
                        }
                    );

                error = result.error;
            }

        /* =========================
           RESET ONE PLAYER
        ========================= */

        }else{

            if(resetType === "upgrades_shop"){

                let result =
                    await supabaseClient.rpc(
                        "admin_reset_player",
                        {
                            target_user_id: adminTargetUserId,
                            reset_type: "upgrades"
                        }
                    );

                error = result.error;

                if(!error){

                    result =
                        await supabaseClient.rpc(
                            "admin_reset_player",
                            {
                                target_user_id: adminTargetUserId,
                                reset_type: "shop"
                            }
                        );

                    error = result.error;
                }

            }else{

                const result =
                    await supabaseClient.rpc(
                        "admin_reset_player",
                        {
                            target_user_id: adminTargetUserId,
                            reset_type: resetType
                        }
                    );

                error = result.error;
            }
        }

        /* =========================
           RESET FAILED
        ========================= */

        if(error){

            console.error(
                "Admin reset error:",
                error
            );

            adminResetInProgress = false;

            alert(
                "Reset failed: " +
                error.message
            );

            return;
        }

        /* =========================
           RELOAD RESET DATA
        ========================= */

        if(
            adminTargetUserId === "ALL" ||
            adminTargetUserId === currentUser.id
        ){

            await load();

            console.log(
                "🔥 ADMIN RESET LOAD RESULT:",
                {
                    rebirths,
                    rebirthCost,
                    clickPower
                }
            );

            /*
             * Force the rebirth reset locally.
             * The database should already contain these values.
             */
            if(resetType === "rebirths"){

                rebirths = 0;
                rebirthCost = 100;
                clickPower = 1;

                console.log(
                    "🔥 REBIRTH RESET APPLIED:",
                    {
                        rebirths,
                        rebirthCost,
                        clickPower
                    }
                );

                // Allow this one corrected reset save
                adminResetInProgress = false;

                await saveOnline();
            }

            updateUI();
            renderInventory();
            renderIndex();
            renderEggs();
            updateRebirthButtons();
        }

        // 🔓 ALLOW SAVING AGAIN
        adminResetInProgress = false;

        alert(
            adminTargetUserId === "ALL"
                ? `ALL PLAYERS' ${resetName} have been reset.`
                : `${adminTargetUsername}'s ${resetName} have been reset.`
        );

    });

document
    .getElementById("adminButton")
    .addEventListener("click", () => {

        document
            .getElementById("adminPanel")
            .classList
            .toggle("hidden");

            loadAdminPlayers();

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

    mysteryBoxCost = Math.floor(mysteryBoxCost * 1.5);

    const mysteryRoll =
        Math.random() * 100;


    const mysteryOverlay =
        document.getElementById("mysteryBoxOverlay");

    const mysteryBoxAnimation =
        document.getElementById("mysteryBoxContainer");

    const mysteryReveal =
        document.getElementById("mysteryBoxReward");

    const mysteryRevealText =
        document.getElementById("mysteryBoxReward");


    /* =========================
       RESET RARITY
    ========================= */

    mysteryOverlay.classList.remove(
        "rarity-common",
        "rarity-rare",
        "rarity-epic",
        "rarity-legendary",
        "rarity-secret"
    );


    /* =========================
       OPEN OVERLAY
    ========================= */

    mysteryOverlay.classList.remove("hidden");
    mysteryOverlay.classList.remove("fading-out");


    mysteryBoxAnimation.classList.remove(
        "shaking",
        "opening"
    );

    void mysteryBoxAnimation.offsetWidth;

    mysteryBoxAnimation.style.display = "flex";

    mysteryBoxAnimation.classList.add("shaking");


    mysteryReveal.classList.remove(
        "show",
        "fade-out",
        "hidden"
    );

    mysteryReveal.style.opacity = "0";


    resultEl.textContent =
        "📦 Mystery Box is opening...";


    /* =========================
       BOX SHAKE
    ========================= */

    setTimeout(() => {

        resultEl.textContent =
            "⚡ The box is shaking...";

    }, 500);


    /* =========================
       SECRET / BIG OPENING
    ========================= */

    setTimeout(() => {

        resultEl.textContent =
            "💥 IT'S OPENING!";

        mysteryBoxAnimation.classList.remove(
            "shaking"
        );

        mysteryBoxAnimation.classList.add(
            "opening"
        );

    }, 1200);


    /* =========================
       REVEAL
    ========================= */

    setTimeout(() => {

        mysteryBoxAnimation.style.display =
            "none";


        mysteryReveal.classList.remove(
            "hidden",
            "fade-out"
        );


        mysteryReveal.style.opacity = "1";

        mysteryReveal.classList.add(
            "show"
        );


        // ======================================
        // 👑 0.01% — SECRET MYSTORIUS
        // ======================================

        if(mysteryRoll < 0.01){

            /*
             * SECRET REWARD
             * The rarer mutations are still possible.
             */

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


            /* =========================
               GIVE SECRET PET
            ========================= */

            inventory[mysteryPet] =
                (inventory[mysteryPet] || 0) + 1;

            discovered.add(mysteryPet);

            // 🌎 GLOBAL SECRET HATCH
            broadcastGlobalHatch(
                mysteryPet,
                "Secret"
            );


            /* =========================
               SECRET ANIMATION
            ========================= */

            mysteryOverlay.classList.add(
                "rarity-secret"
            );


            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">👁️</div>

                <div class="mystery-reward-name">
                    ${mysteryPet}
                </div>

                <div class="mystery-reward-rarity">
                    𝚜𝚎𝚌𝚛𝚎𝚝
                </div>

                <div>
                    ×${formatCoins(
                        getPetMultiplier(mysteryPet)
                    )}
                </div>
            `;


            resultEl.textContent =
                `👑 SECRET PET DISCOVERED! ✨ ${mysteryPet}`;

        }


        // ======================================
        // 💎 29.99% — 25 GEMS
        // ======================================

        else if(mysteryRoll < 30){

            mysteryOverlay.classList.add(
                "rarity-common"
            );

            const reward = 25;

            gems += reward;

            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    💎
                </div>

                <div class="mystery-reward-name">
                    +${formatCoins(reward)} Gems!
                </div>

                <div class="mystery-reward-rarity">
                    COMMON REWARD
                </div>
            `;

            resultEl.textContent =
                `🎉 Mystery Box Reward! 💎 +${formatCoins(reward)} gems!`;

        }


        // ======================================
        // 🎁 25% — 50 GEMS
        // ======================================

        else if(mysteryRoll < 55){

            mysteryOverlay.classList.add(
                "rarity-rare"
            );

            const reward = 50;

            gems += reward;

            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    💎
                </div>

                <div class="mystery-reward-name">
                    +${formatCoins(reward)} Gems!
                </div>

                <div class="mystery-reward-rarity">
                    RARE REWARD
                </div>
            `;

            resultEl.textContent =
                `🎉 Mystery Box Reward! 💎 +${formatCoins(reward)} gems!`;

        }


        // ======================================
        // 🍀 20% — LUCKY BOOST
        // ======================================

        else if(mysteryRoll < 75){

            mysteryOverlay.classList.add(
                "rarity-rare"
            );


            luckyBoostActive = true;

            shopPurchases++;


            unlockAchievement(
                "Activate Lucky Boost"
            );

            checkAchievements();


            luckyBoostEndTime =
                Date.now() + (300 * 1000);


            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    🍀
                </div>

                <div class="mystery-reward-name">
                    Lucky Boost!
                </div>

                <div class="mystery-reward-rarity">
                    RARE · 5 MINUTES
                </div>
            `;


            resultEl.textContent =
                "🎉 Mystery Box Reward! 🍀 Lucky Boost activated for 5 minutes!";

        }


        // ======================================
        // ⚡ 12% — 2X COINS BOOST
        // ======================================

        else if(mysteryRoll < 87){

            mysteryOverlay.classList.add(
                "rarity-epic"
            );


            clickBoostActive = true;

            clickBoostEndTime =
                Date.now() + (300 * 1000);


            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    ⚡
                </div>

                <div class="mystery-reward-name">
                    2× Coins Boost!
                </div>

                <div class="mystery-reward-rarity">
                    EPIC · 5 MINUTES
                </div>
            `;


            resultEl.textContent =
                "🎉 Mystery Box Reward! ⚡ 2× Coins Boost activated for 5 minutes!";

        }


        // ======================================
        // 🎁 7% — 100 GEMS
        // ======================================

        else if(mysteryRoll < 94){

            mysteryOverlay.classList.add(
                "rarity-epic"
            );

            const reward = 100;

            gems += reward;

            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    💎
                </div>

                <div class="mystery-reward-name">
                    GEM JACKPOT!
                </div>

                <div class="mystery-reward-rarity">
                    EPIC · +${formatCoins(reward)} GEMS
                </div>
            `;

            resultEl.textContent =
                `🎉🎉 GEM JACKPOT! 🎉🎉 💎 +${formatCoins(reward)} gems!`;

        }


        // ======================================
        // 💎 4% — 5X CURRENT COINS
        // ======================================

        else if(mysteryRoll < 98){

            mysteryOverlay.classList.add(
                "rarity-legendary"
            );


            const reward =
                coins * 5;


            coins += reward;


            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    💎
                </div>

                <div class="mystery-reward-name">
                    MEGA JACKPOT!
                </div>

                <div class="mystery-reward-rarity">
                    LEGENDARY · +${formatCoins(reward)} COINS
                </div>
            `;


            resultEl.textContent =
                `💎💎 MEGA JACKPOT! 💎💎 +${formatCoins(reward)} coins! · 5× current coins`;

        }


        // ======================================
        // 🔥 2% — 10X CURRENT COINS
        // ======================================

        else{

            mysteryOverlay.classList.add(
                "rarity-legendary"
            );


            const reward =
                coins * 10;


            coins += reward;


            mysteryRevealText.innerHTML = `
                <div class="mystery-reward-emoji">
                    🔥
                </div>

                <div class="mystery-reward-name">
                    ULTRA JACKPOT!
                </div>

                <div class="mystery-reward-rarity">
                    LEGENDARY · +${formatCoins(reward)} COINS
                </div>
            `;


            resultEl.textContent =
                `🔥🔥 ULTRA JACKPOT! 🔥🔥 💰 +${formatCoins(reward)} coins! · 10× current coins`;

        }


        /* =========================
           SAVE
        ========================= */

        updateUI();

        save();


        /* =========================
           FADE REWARD
        ========================= */

        setTimeout(() => {

            mysteryReveal.classList.add(
                "fade-out"
            );

        }, 3000);


        /* =========================
           CLOSE
        ========================= */

        setTimeout(() => {

            mysteryOverlay.classList.add(
                "fading-out"
            );


            setTimeout(() => {

                mysteryOverlay.classList.add(
                    "hidden"
                );


                mysteryOverlay.classList.remove(
                    "fading-out"
                );


                mysteryOverlay.classList.remove(
                    "rarity-common",
                    "rarity-rare",
                    "rarity-epic",
                    "rarity-legendary",
                    "rarity-secret"
                );


                mysteryReveal.classList.remove(
                    "show",
                    "fade-out"
                );


                mysteryReveal.style.opacity = "";


                mysteryBoxAnimation.classList.remove(
                    "shaking",
                    "opening"
                );


                mysteryBoxAnimation.style.display =
                    "flex";


                mysteryRevealText.innerHTML = "";


            }, 700);


        }, 4200);


    }, 1800);

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

    setupGlobalPanel();

    await loadGlobalChat();

    await loadGlobalHatches();

    setupGlobalRealtime();

    setupGlobalPanelDrag();

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

    if(typeof checkAutoRebirth === "function"){
        checkAutoRebirth();
    }

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

function updateDeletePetQuantity(){

    if(!petPendingDeletion){
        return;
    }

    const quantity =
        petPendingDeletion.deleteAmount || 1;

    const quantityText =
        document.getElementById(
            "deletePetQuantity"
        );

    const maxText =
        document.getElementById(
            "deletePetQuantityMax"
        );

    if(quantityText){

        quantityText.textContent =
            quantity;

    }

    if(maxText){

        maxText.textContent =
            `Max: ${petPendingDeletion.available}`;

    }

}

document.addEventListener("click", function(event){

    /* =========================
       ❌ CANCEL
    ========================= */

    if(event.target.closest("#cancelDeletePet")){

        closeDeletePetConfirm();

        return;
    }


    /* =========================
       ➖ DECREASE
    ========================= */

    if(event.target.closest("#deletePetMinus")){

        if(!petPendingDeletion){
            return;
        }

        petPendingDeletion.deleteAmount =
            Math.max(
                1,
                (petPendingDeletion.deleteAmount || 1) - 1
            );

        updateDeletePetQuantity();

        return;
    }


    /* =========================
       ➕ INCREASE
    ========================= */

    if(event.target.closest("#deletePetPlus")){

        if(!petPendingDeletion){
            return;
        }

        petPendingDeletion.deleteAmount =
            Math.min(
                petPendingDeletion.available,
                (petPendingDeletion.deleteAmount || 1) + 1
            );

        updateDeletePetQuantity();

        return;
    }


    /* =========================
       🗑️ CONFIRM DELETE
    ========================= */

    if(event.target.closest("#confirmDeletePet")){

        if(!petPendingDeletion){
            return;
        }

        const name =
            petPendingDeletion.name;

        const equipped =
            petPendingDeletion.equipped;

        const available =
            petPendingDeletion.available;

        const deleteAmount =
            Math.min(
                available,
                Math.max(
                    1,
                    petPendingDeletion.deleteAmount || 1
                )
            );


        const remaining =
            available - deleteAmount;


        const newTotal =
            equipped + remaining;


        if(newTotal <= 0){

            delete inventory[name];

        }else{

            inventory[name] =
                newTotal;

        }


        renderInventory();

        updateUI();

        save();


        showNotification(
            "🗑️ Pet Deleted",
            `Deleted ${formatCoins(
                deleteAmount
            )} ${name}.`
        );


        closeDeletePetConfirm();

    }

});