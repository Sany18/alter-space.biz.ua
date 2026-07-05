const params = new URLSearchParams(window.location.search);
const cloudSavesStatus = document.getElementById('cloud-saves-status');
var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById('spinner');
var wasm_content = params.get("wasm");

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let isTouch = isMobile && window.matchMedia('(pointer: coarse)').matches;

document.body.dataset.isTouch = isTouch ? 1 : 0;

// Real Escape can't be prevented from exiting fullscreen - that's enforced by the
// browser, not us. Remap the (unused) backtick key to a synthetic Escape event
// dispatched to the canvas, so it reaches the game's own input handling without
// ever being a real Escape keypress that the browser would act on.
window.addEventListener('keydown', remapBackquoteToEscape, { capture: true });
window.addEventListener('keyup', remapBackquoteToEscape, { capture: true });
function remapBackquoteToEscape(event) {
    if (event.code !== 'Backquote') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById('canvas').dispatchEvent(new KeyboardEvent(event.type, {
        code: 'Escape',
        key: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
    }));
}

const dataSize = 130 * 1024 * 1024;
const textDecoder = new TextDecoder();
(function () {
    const translations = {
        en: {
            clickToPlayFull: "Click to play",
            checking: "checking...",
            cloudSaves: "Cloud saves:",
            enabled: "enabled",
            disabled: "disabled",
            playDemoText: "You can play the DEMO version, or provide the original game files to play the full version.",
            disclaimer: "DISCLAIMER:",
            disclaimerSources: "This game is based on an open source version of GTA: Vice City. It is not a commercial release and is not affiliated with Rockstar Games.",
            disclaimerCheckbox: "I own the original game",
            disclaimerPrompt: "You need to provide a file from the original game to confirm ownership of the original game.",
            cantContinuePlaying: "You can't continue playing in DEMO version. Please provide the original game files to continue playing.",
            demoAlert: "The demo version is intended only for familiarizing yourself with the game technology. All features are available, but you won’t be able to progress through the game’s storyline. Please provide the original game files to launch the full version.",
            downloading: "Downloading",
            enterKey: "enter your key",
            clickToContinue: "Click to continue...",
            portBy: "HTML5 port by:",
            ukTranslate: "",
            demoOffDisclaimer: "Nothing to see here, move along",
        },
        uk: {
            clickToPlayFull: "Грати",
            checking: "перевірка...",
            cloudSaves: "Хмарні збереження:",
            enabled: "увімкнено",
            disabled: "вимкнено",
            playDemoText: "Ви можете грати в демоверсію або надати оригінальні файли гри для повної версії.",
            disclaimer: "ВІДМОВА ВІД ВІДПОВІДАЛЬНОСТІ:",
            disclaimerSources: "Ця гра заснована на відкритій версії GTA: Vice City. Вона не є комерційним виданням і не пов'язана з Rockstar Games.",
            disclaimerCheckbox: "Я володію оригінальною грою",
            disclaimerPrompt: "Вам потрібно буде додати якийсь файл з оригінальної гри для підтвердження володіння оригінальною грою.",
            cantContinuePlaying: "Ви не можете продовжити гру в демоверсії. Будь ласка, надайте оригінальні файли гри для продовження гри.",
            demoAlert: "Демоверсія призначена лише для ознайомлення з технологією гри. Усі функції доступні, але ви не зможете просуватися сюжетом. Будь ласка, надайте оригінальні файли гри для запуску повної версії.",
            downloading: "Завантаження",
            enterKey: "введіть ваш ключ",
            clickToContinue: "Натисніть, щоб продовжити...",
            portBy: "Автори HTML5-порту:",
            ukTranslate: `
                <div class="translated-by">
                    <span>Люди для людей</span>
                </div>
            `,
            demoOffDisclaimer: "Русня соснула, от і все",
        },
    };

    let currentLanguage = navigator.language.split("-")[0] === "uk" ? "uk" : "en";
    if (params.get("lang") === "uk") {
        currentLanguage = "uk";
    }
    if (params.get("lang") === "en") {
        currentLanguage = "en";
    }

    window.t = function (key) {
        return translations[currentLanguage][key];
    }
})();

async function loadData() {
};

async function startGame(e) {
    e.stopPropagation();

    document.querySelector('.start-container').style.display = 'none';
    document.querySelector('.developed-by').style.display = 'none';
    document.querySelector('.click-to-play').style.display = 'none';

    loadGame();
}

function setStatus(text) {
    console.log(text);
};

async function loadGame() {
    var Module = {
        initFS: async () => {
            await new Promise((resolve, reject) => {
                let files = 0;
                window.addEventListener('message', (event) => {
                    const data = event.data;
                    if (data.event === '>module.initfs') {
                        files = data.files;
                    }

                    if (data.event === '>module.initfile' || data.event === '>module.initfs') {
                        if (data.event === '>module.initfile') {
                            try {
                                const parts = data.path.split('/');
                                let path = '';
                                for (let i = 0; i < parts.length - 1; i++) {
                                    path += '/' + parts[i];
                                    try {
                                        Module.FS.mkdir(path);
                                    } catch (e) {
                                        // Directory already exists, ignore error
                                    }
                                }
                                Module.FS.createDataFile(data.path, 0, data.data, data.data.length);
                            } catch (e) {
                                reject(new Error('Failed to create file: ' + data.path));
                                return;
                            }
                            files--;
                        }
                        if (files > 0) {
                            window.top.postMessage({
                                event: 'module.initfile',
                            }, '*');
                        } else {
                            resolve();
                        }
                    }
                });

                window.top.postMessage({
                    event: 'module.initfs',
                }, '*');
            });

            if (!isMobile) {
                if (window.top === window) {
                    if (!window.location.href.includes('test.js-dos.com')) {
                        document.body.requestFullscreen(document.documentElement);
                    }
                } else {
                    window.top.postMessage({
                        event: 'request-fullscreen',
                    }, '*');
                }
                function lockMouseIfNeeded() {
                    if (!document.pointerLockElement && typeof Module !== 'undefined' && Module.canvas) {
                        Module.canvas.requestPointerLock({
                            unadjustedMovement: true,
                        }).catch(() => {
                            console.warn('Failed to lock in unadjusted movement mode');
                            Module.canvas.requestPointerLock().catch(() => {
                                console.error('Failed to lock in default mode');
                            });
                        });
                    }
                }
                document.addEventListener("mousedown", lockMouseIfNeeded, { capture: true });
                if (navigator.keyboard && navigator.keyboard.lock) {
                    navigator.keyboard.lock(["Escape", "KeyW"]);
                }
            }
        },
        getAsyncUrl: (file) => new Promise((resolve, reject) => {
            file = file.replaceAll("\\", "/").replaceAll("//", "/");
            const listener = (event) => {
                const data = event.data;
                if (data.event === '>module.getasyncurl' && data.file === file) {
                    window.removeEventListener('message', listener);
                    if (data.data) {
                        const url = URL.createObjectURL(new Blob([data.data.buffer]));
                        resolve(url);
                    } else {
                        reject(new Error("File not found: " + file));
                    }
                }
            }
            window.addEventListener('message', listener);
            window.top.postMessage({
                event: 'module.getasyncurl',
                file,
            }, '*');
        }),
        mainCalled: async () => {
            try {
                // Fix a bug in Emscripten's FS.unlink: it finds the target node via a
                // case-insensitive hash lookup, but then deletes it from the parent
                // directory's listing using the exact-case name from the path as
                // typed - if that differs from the case the file actually has, the
                // delete silently no-ops (wrong object key). A subsequent write then
                // creates a separate, out-of-sync duplicate instead of truncating the
                // real file. This is what broke save-slot overwrites: the game's own
                // save code doesn't always request unlink with the same case the file
                // was originally created with.
                const originalUnlink = Module.FS.unlink.bind(Module.FS);
                Module.FS.unlink = (path) => {
                    try {
                        const parent = Module.FS.lookupPath(path, { parent: true }).node;
                        const name = path.split('/').pop();
                        const node = Module.FS.lookupNode(parent, name);
                        if (node.name !== name) {
                            const fixedPath = path.slice(0, path.length - name.length) + node.name;
                            return originalUnlink(fixedPath);
                        }
                    } catch (e) {
                        // Fall through - e.g. genuinely doesn't exist, let the original call raise it
                    }
                    return originalUnlink(path);
                };

                Module.FS.mkdir("/vc-assets");
                Module.FS.mkdir("/vc-assets/local");

                await Module.initFS();

                try {
                    Module.FS.unlink("/vc-assets/local/revc.ini");
                } catch (e) {
                    // ignore
                }
                Module.FS.createDataFile("/vc-assets/local/revc.ini", 0, revc_ini, revc_ini.length);
                Module['_async_main']();
            } catch (e) {
                // Asyncify unwinds the C call stack with this exact sentinel whenever
                // native code pauses to await a JS Promise (e.g. an async file fetch);
                // it automatically rewinds and resumes once that promise resolves.
                // It is expected control flow, not a real error.
                if (e === 'unwind') return;
                console.error('mainCalled error:', e);
            }
        },
        syncRevcIni: () => {
            try {
                const path = Module.FS.lookupPath("/vc-assets/local/revc.ini");
                if (path && path.node && path.node.contents) {
                    localStorage.setItem('vcsky.revc.ini', textDecoder.decode(path.node.contents));
                }
            } catch (e) {
                console.error('syncRevcIni error:', e);
            }
        },
        preRun: [],
        postRun: [],
        print: (...args) => console.log(args.join(' ')),
        printErr: (...args) => {
            const msg = args.join(' ');
            // Benign Emscripten OpenAL shim noise - probing for extension proc
            // addresses before/without a backing context; doesn't indicate broken audio.
            if (msg.includes('alGetProcAddress() called without a valid context')) return;
            console.error(msg);
        },
        canvas: function () {
            const canvas = document.getElementById('canvas');
            canvas.addEventListener('webglcontextlost', (e) => {
                statusElement.textContent = 'WebGL context lost. Please reload the page.';
                e.preventDefault();
            });
            return canvas;
        }(),
        setStatus,
        totalDependencies: 0,
        monitorRunDependencies: (num) => {
            Module.totalDependencies = Math.max(Module.totalDependencies, num);
            Module.setStatus(`Preparing... (${Module.totalDependencies - num}/${Module.totalDependencies})`);
        },
        hotelMission: () => {
            if (!haveOriginalGame) {
                showWasted();
                alert(t("cantContinuePlaying"));
                throw new Error(t("cantContinuePlaying"));
            }
        },
    };
    Module.log = Module.print;
    Module.instantiateWasm = async (
        info,
        receiveInstance,
    ) => {
        const wasm = await (await fetch(wasm_content ? wasm_content : "index.wasm")).arrayBuffer();
        const module = await WebAssembly.instantiate(wasm, info);
        return receiveInstance(module.instance, module);
    };
    Module.arguments = window.location.search
        .slice(1)
        .split('&')
        .filter(Boolean)
        .map(decodeURIComponent);
    window.onbeforeunload = function (event) {
        event.preventDefault();
        return '';
    };

    window.Module = Module;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'index.js';
    document.body.appendChild(script);

    document.body.classList.add('gameIsStarted');

    const emulator = new GamepadEmulator();
    const gamepad = emulator.AddEmulatedGamepad(null, true);
    const gamepadEmulatorConfig = {
        directions: { up: true, down: true, left: true, right: true },
        dragDistance: 100,
        tapTarget: move,
        lockTargetWhilePressed: true,
        xAxisIndex: 0,
        yAxisIndex: 1,
        swapAxes: false,
        invertX: false,
        invertY: false,
    };
    emulator.AddDisplayJoystickEventListeners(0, [gamepadEmulatorConfig]);
    const gamepadEmulatorConfig1 = {
        directions: { up: true, down: true, left: true, right: true },
        dragDistance: 100,
        tapTarget: look,
        lockTargetWhilePressed: true,
        xAxisIndex: 2,
        yAxisIndex: 3,
        swapAxes: false,
        invertX: false,
        invertY: false,
    };
    emulator.AddDisplayJoystickEventListeners(0, [gamepadEmulatorConfig1]);

    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 9,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.menu'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 3,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.car.getIn'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 0,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.run'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 1,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fist'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 5,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.drift'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 2,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.jump'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 4,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.mobile'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 11,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.job'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 4,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.radio'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 7,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.weapon'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 8,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.camera'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 10,
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.horn'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 7,
        buttonIndexes: [1, 7],
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fireRight'),
    }]);
    emulator.AddDisplayButtonEventListeners(0, [{
        buttonIndex: 6,
        buttonIndexes: [1, 6],
        lockTargetWhilePressed: false,
        tapTarget: document.querySelector('.touch-control.fireLeft'),
    }]);

    // Save export/import, driven by the outer page (auto.html).
    // Lives here (not top-level) so it can close over this run's local `Module`.
    const SAVES_ROOT = "/vc-assets/local/userfiles";

    function bytesToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function collectSaveFiles(dir) {
        const results = [];
        let entries;
        try {
            entries = Module.FS.readdir(dir);
        } catch (e) {
            return results;
        }
        for (const name of entries) {
            if (name === '.' || name === '..') continue;
            const fullPath = dir + '/' + name;
            let stat;
            try {
                stat = Module.FS.stat(fullPath);
            } catch (e) {
                continue;
            }
            if (Module.FS.isDir(stat.mode)) {
                results.push(...collectSaveFiles(fullPath));
            } else {
                const bytes = Module.FS.readFile(fullPath);
                results.push({ path: fullPath.slice(SAVES_ROOT.length + 1), data: bytesToBase64(bytes) });
            }
        }
        return results;
    }

    function importSaveFiles(bundle) {
        for (const entry of bundle) {
            const fullPath = SAVES_ROOT + '/' + entry.path;
            const parts = fullPath.slice(1).split('/'); // drop leading "/" so this builds "/a", "/a/b", ... not "//a"
            let dir = '';
            for (let i = 0; i < parts.length - 1; i++) {
                dir += '/' + parts[i];
                try {
                    Module.FS.mkdir(dir);
                } catch (e) {
                    // already exists, ignore
                }
            }
            try {
                Module.FS.unlink(fullPath);
            } catch (e) {
                // didn't exist yet, ignore
            }
            const bytes = base64ToBytes(entry.data);
            Module.FS.createDataFile(fullPath, 0, bytes, bytes.length);
        }
        Module.FS.syncfs(false, (err) => {
            if (err) console.error('syncfs after save import failed:', err);
            else console.log('Saves imported and synced to IndexedDB.');
        });
    }

    window.addEventListener('message', (event) => {
        const data = event.data;
        if (data && data.event === 'export-saves') {
            event.source.postMessage({ event: '>export-saves', bundle: collectSaveFiles(SAVES_ROOT) }, '*');
        } else if (data && data.event === 'import-saves' && data.bundle) {
            importSaveFiles(data.bundle);
        }
    });
}

const clickToPlay = document.querySelector('.click-to-play');
const clickLink = clickToPlay.querySelector('button');
clickToPlay.addEventListener('click', (e) => {
    if (e.target === clickToPlay || e.target === clickLink) {
        startGame(e);
    } else if (window.top !== window) {
        window.top.postMessage({
            event: 'request-fullscreen',
        }, '*');
    }
});

// Skip the "click to play" overlay and start loading immediately.
startGame({ stopPropagation() {} });

// Local saves persist via IDBFS's own IndexedDB sync regardless of this
// wrapper; these hooks only ever bridged to js-dos's cloud-key storage
// (CloudSDK, removed - self-hosted saves use the Export/Import buttons and
// IndexedDB directly instead), so both are now no-ops.
wrapIDBFS(console.log).addListener({
    onLoad: () => null,
    onSave: () => {},
});


// The js-dos cloud-key entry UI (CloudSDK.resolveToken) has been removed -
// self-hosted saves use the Export/Import buttons and IndexedDB directly.
// Its DOM elements (.jsdos-key-input etc.) stay unused in the markup since
// the whole .start-container is hidden by startGame() before this ever runs.

const clickToPlayButton = document.getElementById('click-to-play-button');
clickToPlayButton.textContent = t('clickToPlayFull');
const cloudSavesLink = document.getElementById('cloud-saves-link');
cloudSavesLink.textContent = t('cloudSaves');
cloudSavesStatus.textContent = t('enterKey');
const developedBy = document.querySelector('.developed-by');
developedBy.innerHTML += t('ukTranslate');
const portBy = document.getElementById('port-by');
portBy.textContent = t('portBy');


const revc_iniDefault = `
[VideoMode]
Width=800
Height=600
Depth=32
Subsystem=0
Windowed=0
[Controller]
HeadBob1stPerson=0
HorizantalMouseSens=0.002500
InvertMouseVertically=1
DisableMouseSteering=1
Vibration=0
Method=${isTouch ? '1' : '0'}
InvertPad=0
JoystickName=
PadButtonsInited=0
[Audio]
SfxVolume=36
MusicVolume=37
MP3BoostVolume=0
Radio=0
SpeakerType=0
Provider=0
DynamicAcoustics=1
[Display]
Brightness=256
DrawDistance=1.800000
Subtitles=0
ShowHud=1
RadarMode=0
ShowLegends=0
PedDensity=1.200000
CarDensity=1.200000
CutsceneBorders=1
FreeCam=0
[Graphics]
AspectRatio=0
VSync=1
Trails=1
FrameLimiter=0
MultiSampling=0
IslandLoading=0
PS2AlphaTest=1
ColourFilter=2
MotionBlur=0
VehiclePipeline=0
NeoRimLight=0
NeoLightMaps=0
NeoRoadGloss=0
[General]
SkinFile=$$""
Language=0
DrawVersionText=0
NoMovies=0
[CustomPipesValues]
PostFXIntensity=1.000000
NeoVehicleShininess=1.000000
NeoVehicleSpecularity=1.000000
RimlightMult=1.000000
LightmapMult=1.000000
GlossMult=1.000000
[Rendering]
BackfaceCulling=1
NewRenderer=1
[Draw]
ProperScaling=1
FixRadar=1
FixSprites=1
[Bindings]
PED_FIREWEAPON=mouse:LEFT,2ndKbd:PAD5
PED_CYCLE_WEAPON_RIGHT=2ndKbd:PADENTER,mouse:WHLDOWN,kbd:E
PED_CYCLE_WEAPON_LEFT=kbd:PADDEL,mouse:WHLUP,2ndKbd:Q
GO_FORWARD=kbd:UP,2ndKbd:W
GO_BACK=kbd:DOWN,2ndKbd:S
GO_LEFT=2ndKbd:A,kbd:LEFT
GO_RIGHT=kbd:RIGHT,2ndKbd:D
PED_SNIPER_ZOOM_IN=kbd:PGUP,2ndKbd:Z,mouse:WHLUP
PED_SNIPER_ZOOM_OUT=kbd:PGDN,2ndKbd:X,mouse:WHLDOWN
VEHICLE_ENTER_EXIT=kbd:ENTER,2ndKbd:F
CAMERA_CHANGE_VIEW_ALL_SITUATIONS=kbd:HOME,2ndKbd:V
PED_JUMPING=kbd:RCTRL,2ndKbd:SPC
PED_SPRINT=2ndKbd:LSHIFT,kbd:RSHIFT
PED_LOOKBEHIND=2ndKbd:CAPSLK,mouse:MIDDLE,kbd:PADINS
PED_DUCK=kbd:C
PED_ANSWER_PHONE=kbd:TAB
VEHICLE_FIREWEAPON=kbd:PADINS,2ndKbd:LCTRL,mouse:LEFT
VEHICLE_ACCELERATE=2ndKbd:W
VEHICLE_BRAKE=2ndKbd:S
VEHICLE_CHANGE_RADIO_STATION=kbd:INS,2ndKbd:R
VEHICLE_HORN=2ndKbd:LSHIFT,kbd:RSHIFT
TOGGLE_SUBMISSIONS=kbd:PLUS,2ndKbd:CAPSLK
VEHICLE_HANDBRAKE=kbd:RCTRL,2ndKbd:SPC,mouse:RIGHT
PED_1RST_PERSON_LOOK_LEFT=kbd:PADLEFT
PED_1RST_PERSON_LOOK_RIGHT=kbd:PADHOME
VEHICLE_LOOKLEFT=kbd:PADEND,2ndKbd:Q
VEHICLE_LOOKRIGHT=kbd:PADDOWN,2ndKbd:E
VEHICLE_LOOKBEHIND=mouse:MIDDLE
VEHICLE_TURRETLEFT=kbd:PADLEFT
VEHICLE_TURRETRIGHT=kbd:PAD5
VEHICLE_TURRETUP=kbd:PADPGUP,2ndKbd:UP
VEHICLE_TURRETDOWN=kbd:PADRIGHT,2ndKbd:DOWN
PED_CYCLE_TARGET_LEFT=kbd:[,2ndKbd:PADEND
PED_CYCLE_TARGET_RIGHT=2ndKbd:],kbd:PADDOWN
PED_CENTER_CAMERA_BEHIND_PLAYER=kbd:#
PED_LOCK_TARGET=kbd:DEL,mouse:RIGHT,2ndKbd:PADRIGHT
NETWORK_TALK=kbd:T
PED_1RST_PERSON_LOOK_UP=kbd:PADPGUP
PED_1RST_PERSON_LOOK_DOWN=kbd:PADUP
_CONTROLLERACTION_36=
TOGGLE_DPAD=
SWITCH_DEBUG_CAM_ON=
TAKE_SCREEN_SHOT=
SHOW_MOUSE_POINTER_TOGGLE=
UNKNOWN_ACTION=

`;

const revc_ini = (() => {
    const cached = localStorage.getItem('vcsky.revc.ini');
    if (cached) {
        return cached;
    }
    return revc_iniDefault;
})();