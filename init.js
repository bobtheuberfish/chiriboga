//TECHNICAL NOTE
//May not run locally due to browser security issues. Use a Wamp.
//Firefox earlier than v95.0 might run it locally by setting privacy.file_unique_origin to false in about:config
//Chrome in Windows might work if you launch using: chrome.exe --allow-file-access-from-files

//Include order:
//1. Init
//2. Phase
//3. Command
//4. Utility
//5. Decks

//VARIABLES
var cardRenderer;
var corp = {};
var runner = {};
var viewingPlayer = corp; //for rendering the field, corp or runner (NOT null)
var viewAllFronts = false; //if true, card front will be shown for all cards when zoomed (useful for debugging) NOTE the corp AI will play differently (since all cards are known)
var activePlayer = null;
var removedFromGame = []; //RFG zone
//for running
var attackedServer = null;
var approachIce = -1; //index, 0 is innermost ice
var forceNextIce = null; //if not null, next approach is to this ice index
var encountering = false; //if encountering ice
var movement = false; //if in movement phase
var subroutine = -1; //for resolving subroutines
var accessList = []; //list of cards to access (runner chooses which order to resolve access, except for HQ which is random and RnD which is in order)
var accessingCard = null; //card being accessed
var autoAccessing = false; //used to simplify accessing lots of cards in archives
//for activating abilities, following priority rules, etc.
var playerTurn = corp; //whose turn it is
var opportunitiesGiven = false; //for player response to opportunity to act
var actedThisPhase = false; //for use with above
var checkedClick = false; //used to detect which abilities have click cost
//for use during callbacks
var intended = {};
intended.addTags = 0; //set when tags are to be added
intended.badPublicity = 0; //set when bad publicity is to be added
intended.netDamage = 0; //called when net damage is to be given/taken
intended.meatDamage = 0; //called when meat damage is to be given/taken
intended.trash = null; //called when a card is to be trashed
intended.expose = null; //called when a card is to be exposed
intended.score = null; //called when a card is to be scored
intended.steal = null; //called when a card is to be stolen
//for viewing only
var viewingPile = null; //to look at all cards in a stack
//values modifiable by effects. Don't access these directly, instead use the relevant function
var globalProperties = {};
globalProperties.agendaPointsToWin = 7; //don't modify this or access it directly. Instead use AgendaPointsToWin() for read and card effects to modify.

//INITIALISATION
// Performs the initialisation of game state. Contains the main loop for command mode (user interaction).
function Init() {
  Log("Game begins");

  //Base change to agenda points to win if required
  if (URIParameter("ap") !== "") globalProperties.agendaPointsToWin = parseInt(URIParameter("ap"));

  //Determine whether to view as the Runner or Corp (and therefore which player is to be AI)
  if (URIParameter("faceoff") !== "") {
    //AI faces off against AI
	if (URIParameter("p") == "c") viewingPlayer = corp;
    else viewingPlayer = runner;
    runner.AI = new RunnerAI(); //computer control
    corp.AI = new CorpAI(); //computer control
  } else if (URIParameter("p") == "c") {
    viewingPlayer = corp;
    corp.AI = null; //human control
    runner.AI = new RunnerAI(); //computer control
    corp.testAI = null; //new CorpAI(); //use for testing
  } else if ((URIParameter("p") == "r")||(URIParameter("r") !== "")) {
    viewingPlayer = runner;
    corp.AI = new CorpAI(); //computer control
    runner.AI = null; //human control
    runner.testAI = null; //new RunnerAI(); //use for testing
  } else {
    viewingPlayer = corp;
    corp.AI = null; //human control
    runner.AI = new RunnerAI(); //computer control
    corp.testAI = null; //new CorpAI(); //use for testing
  }

  //Prepare player variables
  //Corp
  corp.identityCard = null;
  corp.creditPool = 0;
  corp.clickTracker = 0;
  corp.scoreArea = []; //scored agendas
  corp.HQ = NewServer("HQ", true); //corp.HQ.cards is corp hand
  corp.RnD = NewServer("R&D", true);
  corp.archives = NewServer("Archives", true);
  corp.remoteServers = [];
  corp.serverIncrementer = 0; //keep track of remote server ID even when destroyed
  corp.maxHandSize = 5;
  corp._renderOnlyHandSize = corp.maxHandSize; //don't use this for anything
  corp.resolvingCards = [];
  corp.installingCards = []; //card(s) being installed (they stay in place rather than moving during render)
  corp.badPublicity = 0;
  //Runner
  runner.identityCard = null;
  runner.creditPool = 0;
  runner.temporaryCredits = 0; //generated at start of run, removed at end of run (e.g. from bad publicity)
  runner.clickTracker = 0;
  runner.startingMU = 4;
  runner._renderOnlyMU = runner.startingMU; //don't use this for anything
  runner.scoreArea = []; //stolen agendas
  runner.grip = []; //runner hand
  runner.stack = [];
  runner.heap = [];
  runner.rig = {}; //three 'rows', see below
  runner.rig.programs = [];
  runner.rig.hardware = [];
  runner.rig.resources = [];
  runner.maxHandSize = 5; //this is the base, use MaxHandSize(player) to get actual
  runner._renderOnlyHandSize = runner.maxHandSize; //don't use this for anything
  runner.tags = 0;
  runner.brainDamage = 0;
  runner.resolvingCards = []; //cards move to a special 'resolving' area until resolved
  runner.installingCards = []; //card(s) being installed (they stay in place rather than moving during render)

  //Initialise the renderer
  cardRenderer = new CardRenderer.Renderer(ResizeCallback); //The parameter here is resizeCallback i.e. ResizeCallback is called on resize

  //place the card renderer between background image and page elements
  document
    .getElementById("contentcontainer")
    .insertBefore(cardRenderer.app.view, document.getElementById("output"));
  var loader = new PIXI.loaders.Loader();
  loader.add("images/Corp_back.png");
  loader.add("images/Runner_back.png");
  loader.load(Setup); //once back textures are loaded, the GUI can be generated, so this calls Setup

  //watch for exit from fullscreen (to restore the button)
  document.addEventListener("fullscreenchange", (event) => {
    if (!document.fullscreenElement) $(".fullscreen-button").show();
  });
}

//resize callback
function ResizeCallback() {
  viewingGrid = previousViewingGrid;
  Render();
}

//sub-helper function used in RenderCards
function RenderCard(card, modifier, i) {
  card.renderer.SetRotation(0); //reset target rotation pre-render (e.g. in case it has moved from hand and kept an extra rotation effect)
  if (IsFaceUp(card)) card.renderer.FaceUp(Strength(card));
  else card.renderer.FaceDown();
  if (card.player == corp) card.renderer.SetRotation(180);
  card.renderer.canView = PlayerCanLook(viewingPlayer, card);
  if (card.renderer.zoomed) zoomedCards.push(card);
  modifier(card, i);
}

//helper function to create list of render cards from game cards, modifier is function(card,i)
function RenderCards(cards, modifier) {
  var ret = [];
  for (var i = 0; i < cards.length; i++) {
    RenderCard(cards[i], modifier, i);
    if (typeof cards[i].hostedCards !== "undefined") {
      for (var j = 0; j < cards[i].hostedCards.length; j++) {
        RenderCard(cards[i].hostedCards[j], FaceUpNoTint, i); //assuming this is what we want for all hosted cards...could change this later
      }
    }
    ret.push(cards[i].renderer);
  }
  return ret;
}

//helper functions for tinting facedown cards
function TintAndRotateIfFaceDown(card, i) {
  if (IsFaceUp(card)) {
    if (card.player == corp) card.renderer.SetRotation(180);
    else card.renderer.SetRotation(0);
    card.renderer.Tint(0, 0, 100);
  } else {
    if (card.player == corp) card.renderer.SetRotation(270);
    else card.renderer.SetRotation(90);
    card.renderer.Tint(0, 0, 90 + 10 * Math.sin(2.0 * i));
  }
}
function TintIfFaceDown(card, i) {
  if (IsFaceUp(card)) card.renderer.Tint(0, 0, 100);
  else card.renderer.Tint(0, 0, 90 + 10 * Math.sin(2.0 * i));
}
function RotateNoTint(card, i) {
  card.renderer.SetRotation(90);
  card.renderer.Tint(0, 0, 100);
}
function ZeroRotationNoTint(card, i) {
  card.renderer.SetRotation(0);
  card.renderer.Tint(0, 0, 100);
}
function PiRotationNoTint(card, i) {
  card.renderer.SetRotation(180);
  card.renderer.Tint(0, 0, 100);
}
function FaceUpNoTint(card, i) {
  card.renderer.FaceUp();
  card.renderer.Tint(0, 0, 100);
}
function NoTint(card, i) {
  card.renderer.Tint(0, 0, 100);
}
function RandomTint(card, i) {
  card.renderer.Tint(0, 0, 90 + 10 * Math.sin(2.0 * i));
}

function FanHand(player) {
  var handOfCards = runner.grip;
  if (player == corp) handOfCards = corp.HQ.cards;
  var totalFanRotation = 5.0 * handOfCards.length;
  if (player == corp) totalFanRotation *= -1;
  if (viewingPlayer == corp) totalFanRotation *= -1;
  var fanIterator = 0;
  if (handOfCards.length > 1)
    fanIterator = totalFanRotation / (handOfCards.length - 1);
  else totalFanRotation = 0;
  for (var i = 0; i < handOfCards.length; i++) {
    var rotAmt = -totalFanRotation * 0.5 + fanIterator * i;
    var offsetY = -350 * Math.cos(1.7 * rotAmt * (Math.PI / 180)) + 300;
    if (player == corp) rotAmt += 180;
    handOfCards[i].renderer.SetRotation(rotAmt);
    var nonViewingHandOffsetY = 35;
    if (player == corp) {
      offsetY *= -1;
      if (viewingPlayer == runner) offsetY -= nonViewingHandOffsetY;
    } else if (viewingPlayer == corp) offsetY += nonViewingHandOffsetY;
    handOfCards[i].renderer.destinationPosition.y += offsetY;
  }
}

//render everything (update all card renderers)
// the server area is stored in each server as xStart and xEnd for hover checking
var zoomedCards = [];
var viewingGrid = null; //if not null, will render all these cards as a grid instead of the usual field
var previousViewingGrid = null; //in case we need it for more than one render
var fieldZoom = 1.0;
function Render() {
  if (mainLoopDelay < 1) return; //console only if rapidplay required

  previousViewingGrid = null;

  cardRenderer.app.renderer.plugins.sprite.sprites.length = 0; //helps with garbage collection
  //https://github.com/pixijs/pixi-particles#note-on-emitter-cleanup

  var footerBackground = "#77779999";
  if (activePlayer == runner) {
    footerBackground = "#99777799";
  }
  $("#footer").css("background", footerBackground);

  //keep installing card where it was dropped by storing it here and restoring it after apply of cascades
  //part 1 of 2: store
  for (var i = 0; i < corp.installingCards.length; i++) {
    var installingCard = corp.installingCards[i];
    installingCard.renderer.temporaryStorage.x =
      installingCard.renderer.destinationPosition.x;
    installingCard.renderer.temporaryStorage.y =
      installingCard.renderer.destinationPosition.y;
    installingCard.renderer.temporaryStorage.faceUp =
      installingCard.renderer.faceUp;
  }
  for (var i = 0; i < runner.installingCards.length; i++) {
    var installingCard = runner.installingCards[i];
    installingCard.renderer.temporaryStorage.x =
      installingCard.renderer.destinationPosition.x;
    installingCard.renderer.temporaryStorage.y =
      installingCard.renderer.destinationPosition.y;
    installingCard.renderer.temporaryStorage.faceUp =
      installingCard.renderer.faceUp;
  }

  cardRenderer.HideParticleContainers(); //so they don't influence extents

  var tightXStep = -0.3;
  var tightYStep = -0.5;
  var spreadXStep = 100;
  var scoreAreaXStep = 30;
  var spreadYStep = -15;
  var corpHeaderFooter = 430;
  var runnerHeaderFooter = 430;
  if (viewingPlayer == corp) {
    tightXStep *= -1;
    tightYStep *= -1;
    spreadXStep *= -1;
    scoreAreaXStep *= -1;
    spreadYStep *= -1;
    corpHeaderFooter = 430;
    runnerHeaderFooter = 430;
    $("#header").css("width", runnerHeaderFooter + "px");
    $("#footer").css("width", corpHeaderFooter + "px");
  } else {
    $("#header").css("width", corpHeaderFooter + "px");
    $("#footer").css("width", runnerHeaderFooter + "px");
  }

  var hostingX = 15; //was 30

  zoomedCards = []; //RenderCards will fill this with any zoomed cards (because they are temporarily unzoomed for placement and sizing)

  //Render all RFG'd cards out of screen
  for (var i = 0; i < removedFromGame.length; i++) {
    removedFromGame[i].renderer.destinationPosition.x = -1000;
  }

  //Runner
  var resourcesCascade = new CardRenderer.Cascade(
    RenderCards(runner.rig.resources, NoTint),
    180,
    0,
    hostingX
  );
  var hardwareCascade = new CardRenderer.Cascade(
    RenderCards(runner.rig.hardware, NoTint),
    180,
    0,
    hostingX
  );
  var programsCascade = new CardRenderer.Cascade(
    RenderCards(runner.rig.programs, NoTint),
    180,
    0,
    hostingX
  );
  var heapCascade = new CardRenderer.Cascade(
    RenderCards(runner.heap, NoTint),
    tightXStep,
    tightYStep,
    hostingX
  );
  if (heapCascade.width < 180) heapCascade.width = 180; //leave a pre-prepared blank area for heap
  var stackCascade = new CardRenderer.Cascade(
    RenderCards(runner.stack, RandomTint),
    tightXStep,
    tightYStep,
    hostingX
  );
  var gripCascade;
  if (viewingPlayer == runner)
    gripCascade = new CardRenderer.Cascade(
      RenderCards(runner.grip, FaceUpNoTint),
      spreadXStep,
      0,
      hostingX
    );
  else
    gripCascade = new CardRenderer.Cascade(
      RenderCards(runner.grip, NoTint),
      spreadXStep * 0.7,
      0,
      hostingX
    );
  var identityCascade = new CardRenderer.Cascade(
    RenderCards([runner.identityCard], NoTint),
    spreadXStep,
    spreadYStep,
    hostingX
  );
  var stolenCascade = new CardRenderer.Cascade(
    RenderCards(runner.scoreArea, ZeroRotationNoTint),
    (viewingPlayer==corp?-1:1)*scoreAreaXStep,
    -spreadYStep,
    hostingX
  );
  var runnerResolvingCascade = new CardRenderer.Cascade(
    RenderCards(runner.resolvingCards, NoTint),
    spreadXStep,
    0,
    hostingX
  );
  var verticalRowSpacing = -70;
  var stolenIdentitySpacing = 30;
  var stolenIdentityOffsetY = 0;
  var stackHeapSpacingX = 30;
  var stackHeapSpacingY = 0;
  var runnerLargestHeight = Math.max(
    resourcesCascade.height + hardwareCascade.height + programsCascade.height,
    identityCascade.height + stackCascade.height
  );

  //Corp
  var corpHandCascade;
  if (viewingPlayer == corp)
    corpHandCascade = new CardRenderer.Cascade(
      RenderCards(corp.HQ.cards, FaceUpNoTint),
      spreadXStep,
      0,
      hostingX
    );
  else
    corpHandCascade = new CardRenderer.Cascade(
      RenderCards(corp.HQ.cards, NoTint),
      spreadXStep * 0.7,
      0,
      hostingX
    );
  var scoredCascade = new CardRenderer.Cascade(
    RenderCards(corp.scoreArea, NoTint),
    (viewingPlayer==runner?-1:1)*scoreAreaXStep,
    spreadYStep,
    hostingX
  );
  var totalServersWidth = 0;
  var iceSeparationY = 100;
  var archivesCardsCascade = new CardRenderer.Cascade(
    RenderCards(corp.archives.cards, TintAndRotateIfFaceDown),
    tightXStep,
    tightYStep,
    hostingX,
    -30
  );
  var archivesRootCascade = new CardRenderer.Cascade(
    RenderCards(corp.archives.root, TintIfFaceDown),
    spreadXStep,
    0,
    hostingX
  );
  var archivesIceCascade = new CardRenderer.Cascade(
    RenderCards(corp.archives.ice, RotateNoTint),
    0,
    iceSeparationY,
    hostingX
  );
  var archivesWidth = Math.max(
    archivesCardsCascade.width,
    archivesRootCascade.width,
    archivesIceCascade.width,
    150
  ); //the 150 is just arbitrary aesthetics when archives empty/unprotected/unupgraded
  totalServersWidth += archivesWidth;
  var RnDCardsCascade = new CardRenderer.Cascade(
    RenderCards(corp.RnD.cards, TintIfFaceDown),
    tightXStep,
    tightYStep,
    hostingX
  );
  var RnDRootCascade = new CardRenderer.Cascade(
    RenderCards(corp.RnD.root, TintIfFaceDown),
    spreadXStep,
    0,
    hostingX
  );
  var RnDIceCascade = new CardRenderer.Cascade(
    RenderCards(corp.RnD.ice, RotateNoTint),
    0,
    iceSeparationY,
    hostingX
  );
  var RnDWidth = Math.max(
    RnDCardsCascade.width,
    RnDRootCascade.width,
    RnDIceCascade.width
  );
  totalServersWidth += RnDWidth;
  var HQCardsCascade = new CardRenderer.Cascade(
    RenderCards([corp.identityCard], NoTint),
    spreadXStep,
    0,
    hostingX
  );
  var HQRootCascade = new CardRenderer.Cascade(
    RenderCards(corp.HQ.root, TintIfFaceDown),
    spreadXStep,
    0,
    hostingX
  );
  var HQIceCascade = new CardRenderer.Cascade(
    RenderCards(corp.HQ.ice, RotateNoTint),
    0,
    iceSeparationY,
    hostingX
  );
  var HQWidth = Math.max(
    HQCardsCascade.width,
    HQRootCascade.width,
    HQIceCascade.width
  );
  totalServersWidth += HQWidth;
  var serverSeparationY = 20;
  var rootHeight =
    Math.max(
      archivesRootCascade.height,
      RnDRootCascade.height,
      HQRootCascade.height
    ) + serverSeparationY;
  var serverCardsHeight =
    Math.max(
      archivesCardsCascade.height,
      RnDCardsCascade.height,
      HQCardsCascade.height
    ) + serverSeparationY;
  var archivesHeight =
    rootHeight + serverCardsHeight + archivesIceCascade.height;
  var RnDHeight = rootHeight + serverCardsHeight + RnDIceCascade.height;
  var HQHeight = rootHeight + serverCardsHeight + HQIceCascade.height;
  var largestServerHeight = Math.max(archivesHeight, RnDHeight, HQHeight);
  var remoteCascades = [];
  for (var i = 0; i < corp.remoteServers.length; i++) {
    var remoteCardsCascade = new CardRenderer.Cascade(
      RenderCards(corp.remoteServers[i].root, NoTint),
      spreadXStep,
      0,
      hostingX
    );
    var remoteIceCascade = new CardRenderer.Cascade(
      RenderCards(corp.remoteServers[i].ice, RotateNoTint),
      0,
      iceSeparationY,
      hostingX
    );
    var remoteWidth = Math.max(
      remoteCardsCascade.width,
      remoteIceCascade.width
    );
    totalServersWidth += remoteWidth;
    remoteCascades.push({
      cards: remoteCardsCascade,
      ice: remoteIceCascade,
      width: remoteWidth,
    });
    var remoteHeight =
      rootHeight + serverCardsHeight + remoteCascades[i].ice.height;
    if (remoteHeight > largestServerHeight) largestServerHeight = remoteHeight;
  }
  totalServersWidth += 250; //arbitrary space for null server (remote placeholder)
  var corpResolvingCascade = new CardRenderer.Cascade(
    RenderCards(corp.resolvingCards, NoTint),
    spreadXStep,
    0,
    hostingX
  );

  var arbitraryHistorySpacer = 55;
  var arbitraryMenubarSpacer = 115;

  var serverSeparationX = 40;
  var serverStartX = scoredCascade.width + serverSeparationX;
  if (viewingPlayer == corp) serverStartX += arbitraryHistorySpacer;

  //scale field to match approximate height (do this BEFORE any apply, so that cards are rendered in the new field)
  var w = window.innerWidth;
  var h = window.innerHeight;
  cardRenderer.app.view.style.width = w + "px";
  cardRenderer.app.view.style.height = h + "px";
  cardRenderer.app.stage.pivot.x = w * 0.5;
  cardRenderer.app.stage.pivot.y = h * 0.5;
  cardRenderer.app.stage.x = w * 0.5;
  cardRenderer.app.stage.y = h * 0.5;
  //zoom the field out if there is too much on it
  fieldZoom = 1.0;
  var interfaceScale = 1.0;
  //calculate field height from total height of runner + spacer + corp
  var totalFieldHeight = runnerLargestHeight - 150 + largestServerHeight;
  if (totalFieldHeight < 700) totalFieldHeight = 700; //this is approximately 1 layer of ice
  var fieldHeightRatio = totalFieldHeight / h;
  //calculate field width from corp field (assumes this will be wider than runner field)
  var totalFieldWidth =
    scoredCascade.width +
    serverSeparationX * (4 + corp.remoteServers.length) +
    totalServersWidth;
  if (totalFieldWidth < 1000) totalFieldWidth = 1000; //this is approximately 1 remote with ice
  var fieldWidthRatio = (totalFieldWidth + arbitraryHistorySpacer) / w;
  var largestRatio = Math.max(fieldHeightRatio, fieldWidthRatio);
  if (largestRatio > 1.0) {
    fieldZoom = largestRatio;
    interfaceScale = 1.0 / fieldZoom;
  }
  var oldW = w;
  w *= fieldZoom;
  var oldH = h;
  h *= fieldZoom;
  cardRenderer.app.renderer.resize(w, h);
  //correct stage positioning after zoom
  if (viewingPlayer == corp) {
    cardRenderer.app.stage.x += w - oldW;
    cardRenderer.app.stage.y += h - oldH;
  }
  w -= arbitraryHistorySpacer; //leave space for history sidebar
  cardRenderer.tutorialText.x = 15;
  cardRenderer.tutorialText.y = h - 170;
  //scale interface to match game zoom
  $("#footer").css("transform-origin", "bottom left");
  $("#footer").css("transform", "scale(" + interfaceScale + ")");
  $("#header").css("transform-origin", "top right");
  $("#header").css("transform", "scale(" + interfaceScale + ")");
  $("#menubar").css("transform-origin", "top left");
  $("#menubar").css("transform", "scale(" + interfaceScale + ")");
  $("#history-wrapper").css("width", interfaceScale * 56 + "px");
  $("#history-wrapper").css("top", interfaceScale * 65 + "px");
  $("#history").css("width", interfaceScale * 56 + "px");
  $(".historycontents").css("transform-origin", "top left");
  $(".historycontents").css("transform", "scale(" + interfaceScale + ")");
  $(".historyentry").css("background-size", "100% 100%");
  $(".historyentry").css("height", interfaceScale * 50 + "px");
  $(".historyentry").css("width", interfaceScale * 50 + "px");
  $(".fullscreen-button").css("transform-origin", "top right");
  $(".fullscreen-button").css("transform", "scale(" + interfaceScale + ")");
  corpHeaderFooter *= interfaceScale;
  runnerHeaderFooter *= interfaceScale;

  //now apply all the renders
  //RUNNER
  var runnerYBottom = -70; //above hand
  if (viewingPlayer == corp) stolenIdentityOffsetY += 30;
  var resourceRowHeight = Math.min(
    -resourcesCascade.height - verticalRowSpacing,
    0
  );
  var hardwareRowHeight = Math.min(
    -hardwareCascade.height - verticalRowSpacing,
    0
  );
  var rowCentreX =
    (w -
      Math.max(
        stolenCascade.width + identityCascade.width,
        stackCascade.width + heapCascade.width
      )) *
    0.5;
  programsCascade.Apply(
    cardRenderer.app,
    rowCentreX,
    h + runnerYBottom + resourceRowHeight + hardwareRowHeight,
    0.5,
    1,
    hostingX
  );
  hardwareCascade.Apply(
    cardRenderer.app,
    rowCentreX,
    h + runnerYBottom + resourceRowHeight,
    0.5,
    1,
    hostingX
  );
  resourcesCascade.Apply(
    cardRenderer.app,
    rowCentreX,
    h + runnerYBottom,
    0.5,
    1,
    hostingX
  );
  stolenCascade.Apply(
    cardRenderer.app,
    w,
    h + runnerYBottom + stolenIdentityOffsetY,
    1,
    1,
    hostingX
  );
  identityCascade.Apply(
    cardRenderer.app,
    w - stolenCascade.width - stolenIdentitySpacing,
    h + stolenIdentityOffsetY + runnerYBottom,
    1,
    1,
    hostingX
  );
  var stackHeapBottom =
    h +
    stackHeapSpacingY -
    Math.max(stolenCascade.height, identityCascade.height) +
    stolenIdentityOffsetY; //runnerYBottom intentionally not included
  heapCascade.Apply(cardRenderer.app, w, stackHeapBottom, 1, 1, hostingX);
  runner.heap.xStart = w - heapCascade.width;
  runner.heap.xEnd = w;
  runner.heap.yCards = stackHeapBottom;
  stackCascade.Apply(
    cardRenderer.app,
    w - heapCascade.width - stackHeapSpacingX,
    stackHeapBottom,
    1,
    1,
    hostingX
  );
  runner.stack.xStart =
    w - heapCascade.width - stackHeapSpacingX - stackCascade.width;
  runner.stack.xEnd = w - heapCascade.width - stackHeapSpacingX;
  runner.stack.yCards = stackHeapBottom;
  runnerResolvingCascade.Apply(
    cardRenderer.app,
    w - heapCascade.width - stackHeapSpacingX * 2 - stackCascade.width,
    stackHeapBottom + runnerYBottom,
    0.5,
    0.75,
    hostingX
  );
  var runnerHandX = w - (w - runnerHeaderFooter * fieldZoom) * 0.5;
  gripCascade.Apply(cardRenderer.app, runnerHandX, h, 0.5, 0.5, hostingX); //runnerYBottom intentionally not included. space left for footer/header
  FanHand(runner);

  //CORP
  //aesthetic improvements to fit more on the screen
  var corpYTop = 20;
  if (viewingPlayer == corp) corpYTop = 50;
  serverCardsHeight -= 80;
  rootHeight += corpYTop;
  if (rootHeight > 80) rootHeight -= 80;
  else if (rootHeight < 100 || viewingPlayer == corp) rootHeight = 100; //leave some space, even if no upgrades, so drawing from deck feels right
  var attackedServerGlow = { x: 0, y: serverCardsHeight * 0.5 + rootHeight }; //used for rendering glow
  cardRenderer.archivesIndicator.y = serverCardsHeight * 0.5 + rootHeight; //used for choosing empty archives
  cardRenderer.newRemoteIndicator.y = serverCardsHeight * 0.5 + rootHeight; //used for choosing new server
  cardRenderer.serverSelector.y = serverCardsHeight * 0.5 + rootHeight; //highlight to choosing a server
  cardRenderer.serverSelector.scale.y = largestServerHeight / 44.0; //44 is the height of the particles.png image
  cardRenderer.serverText.y = 105.0 + cardRenderer.serverSelector.y;
  if (viewingPlayer == corp) {
    cardRenderer.serverText.rotation = Math.PI;
    cardRenderer.serverText.y += 6;
  }

  scoredCascade.Apply(cardRenderer.app, 0, corpYTop, 0, 0, hostingX);
  archivesRootCascade.Apply(
    cardRenderer.app,
    archivesWidth * 0.5 + serverStartX,
    corpYTop,
    0.5,
    0,
    hostingX
  );
  archivesCardsCascade.Apply(
    cardRenderer.app,
    archivesWidth * 0.5 + serverStartX,
    rootHeight,
    0.5,
    0,
    hostingX,
    5
  );
  archivesIceCascade.Apply(
    cardRenderer.app,
    archivesWidth * 0.5 + serverStartX,
    rootHeight + serverCardsHeight,
    0.5,
    0,
    hostingX
  );
  if (attackedServer == corp.archives)
    attackedServerGlow.x = archivesWidth * 0.5 + serverStartX;
  corp.archives.xStart = serverStartX;
  corp.archives.xEnd = serverStartX + archivesWidth;
  corp.archives.yCards = rootHeight;
  serverStartX += archivesWidth + serverSeparationX;
  RnDRootCascade.Apply(
    cardRenderer.app,
    RnDWidth * 0.5 + serverStartX,
    corpYTop,
    0.5,
    0,
    hostingX
  );
  RnDCardsCascade.Apply(
    cardRenderer.app,
    RnDWidth * 0.5 + serverStartX,
    rootHeight,
    0.5,
    0,
    hostingX
  );
  RnDIceCascade.Apply(
    cardRenderer.app,
    RnDWidth * 0.5 + serverStartX,
    rootHeight + serverCardsHeight,
    0.5,
    0,
    hostingX
  );
  if (attackedServer == corp.RnD)
    attackedServerGlow.x = RnDWidth * 0.5 + serverStartX;
  corp.RnD.xStart = serverStartX;
  corp.RnD.xEnd = serverStartX + RnDWidth;
  corp.RnD.yCards = rootHeight;
  serverStartX += RnDWidth + serverSeparationX;
  HQRootCascade.Apply(
    cardRenderer.app,
    HQWidth * 0.5 + serverStartX,
    corpYTop,
    0.5,
    0,
    hostingX
  );
  HQCardsCascade.Apply(
    cardRenderer.app,
    HQWidth * 0.5 + serverStartX,
    rootHeight,
    0.5,
    0,
    hostingX
  );
  HQIceCascade.Apply(
    cardRenderer.app,
    HQWidth * 0.5 + serverStartX,
    rootHeight + serverCardsHeight,
    0.5,
    0,
    hostingX
  );
  if (attackedServer == corp.HQ)
    attackedServerGlow.x = HQWidth * 0.5 + serverStartX;
  corp.HQ.xStart = serverStartX;
  corp.HQ.xEnd = serverStartX + HQWidth;
  serverStartX += HQWidth + serverSeparationX;
  for (var i = 0; i < remoteCascades.length; i++) {
    remoteCascades[i].cards.Apply(
      cardRenderer.app,
      remoteCascades[i].width * 0.5 + serverStartX,
      rootHeight,
      0.5,
      0,
      hostingX
    );
    remoteCascades[i].ice.Apply(
      cardRenderer.app,
      remoteCascades[i].width * 0.5 + serverStartX,
      rootHeight + serverCardsHeight,
      0.5,
      0,
      hostingX
    );
    if (attackedServer == corp.remoteServers[i])
      attackedServerGlow.x = remoteCascades[i].width * 0.5 + serverStartX;
    corp.remoteServers[i].xStart = serverStartX;
    corp.remoteServers[i].xEnd = serverStartX + remoteCascades[i].width;
    serverStartX += remoteCascades[i].width + serverSeparationX;
  }
  corpResolvingCascade.Apply(cardRenderer.app, w * 0.5, 0, 0.5, 0.25, hostingX);
  var corpHandX =
    (w - corpHeaderFooter * fieldZoom + arbitraryMenubarSpacer) * 0.5;
  corpHandCascade.Apply(cardRenderer.app, corpHandX, 0, 0.5, 0.5, hostingX);
  FanHand(corp);

  //put server labels on top
  cardRenderer.app.stage.addChild(cardRenderer.serverText);

  //render viewing grid, either for access or just view
  if (viewingGrid == null && viewingPile !== null) viewingGrid = viewingPile;
  else if (viewingGrid !== null) viewingPile = null; //access takes precedence over view
  if (viewingGrid !== null) {
    //either from view or access
    //include at most 1 copy of each card
    var uniqueGrid = [];
    for (var i = 0; i < viewingGrid.length; i++) {
      if (!uniqueGrid.includes(viewingGrid[i])) uniqueGrid.push(viewingGrid[i]);
    }
    //now lay out the grid
    var gridViewXStep = 150;
    var gridViewYStep = 130;
    var gridViewY = 80;
    var gridRowStart = 0;
    var cardsPerGridRow = Math.floor(w / gridViewXStep);
    while (gridRowStart < uniqueGrid.length) {
      var gridViewRowCards = [];
      for (
        var i = gridRowStart;
        i - gridRowStart < cardsPerGridRow && i < uniqueGrid.length;
        i++
      ) {
        gridViewRowCards.push(uniqueGrid[i]);
      }
	  var gridViewModifier = FaceUpNoTint;
	  if ( (viewingPile == corp.archives.cards) && (viewingPlayer == runner) ) gridViewModifier = ZeroRotationNoTint;
	  else if ( (viewingPile == runner.heap) && (viewingPlayer == corp) ) gridViewModifier = PiRotationNoTint;
      var gridViewCascade = new CardRenderer.Cascade(
        RenderCards(gridViewRowCards, gridViewModifier),
        gridViewXStep,
        0,
        0
      );
      if (viewingPile == runner.heap)
        gridViewCascade.Apply(
          cardRenderer.app,
          w - gridViewCascade.width,
          runner.heap.yCards - gridViewCascade.height - gridViewY,
          0,
          0,
          0
        );
      else if (viewingPlayer == corp)
        gridViewCascade.Apply(
          cardRenderer.app,
          5 + arbitraryHistorySpacer,
          gridViewY,
          0,
          0,
          0
        );
      else gridViewCascade.Apply(cardRenderer.app, 20, gridViewY, 0, 0, 0);
      gridRowStart += cardsPerGridRow;
      gridViewY += gridViewYStep;
    }
    //viewingGrid is just a once-off state but store it in case needed e.g. window resize
    previousViewingGrid = viewingGrid;
    viewingGrid = null;
  }

  //Field rendered, now overlay any GUI
  var corpFooterHeight = 65;
  var guiWOffset = 0;
  var guiWSpacingModifier = 0;
  if (viewingPlayer == corp) {
    guiWOffset = 45;
    guiWSpacingModifier = 7;
  }
  var originalGuiWOffset = guiWOffset;
  //if (viewingPlayer != corp) corpFooterHeight = 0;
  countersUI.credits.corp.SetPosition(
    guiWOffset + w - 40,
    40 + corpFooterHeight
  );
  guiWOffset -= guiWSpacingModifier;
  countersUI.click.corp.SetPosition(
    guiWOffset + w - 114,
    40 + corpFooterHeight
  );
  guiWOffset -= guiWSpacingModifier;
  countersUI.hand_size.corp.SetPosition(
    guiWOffset + w - 204,
    40 + corpFooterHeight
  );
  corp._renderOnlyHandSize = MaxHandSize(corp);
  countersUI.hand_size.corp.prefix = corp.HQ.cards.length + "/";
  countersUI.hand_size.corp.richText.text =
    countersUI.hand_size.corp.prefix + corp._renderOnlyHandSize;
  //guiWOffset -= guiWSpacingModifier;
  //countersUI.bad_publicity.corp.SetPosition(guiWOffset+w-204,40+corpFooterHeight);
  guiWOffset -= guiWSpacingModifier;
  countersUI.bad_publicity.corp.SetPosition(guiWOffset + w - 204, -100); //moved off-screen for basic tutorial game

  var runnerFooterHeight = 65;
  guiWOffset = originalGuiWOffset;
  counterPositionings = [];
  //e is element, rw is width when viewing as runner, cw is that but as corp, h is height, s is whether to show it
  counterPositionings.push({ e: countersUI.credits.runner, rw: 40, cw: 40, h: 40, s: !runner.identityCard.hideCredits });
  counterPositionings.push({ e: countersUI.click.runner, rw: 70, cw: 70, h: 40, s: !runner.identityCard.hideClicks });
  counterPositionings.push({ e: countersUI.tag.runner, rw: 85, cw: 85, h: 39, s: (!runner.identityCard.hideTags && globalProperties.agendaPointsToWin == 7) }); //hide for tutorial deck
  counterPositionings.push({ e: countersUI.mu.runner, rw: 80, cw: 100, h: 38, s: !runner.identityCard.hideMU });
  //counterPositionings.push({ e: countersUI.brain_damage.runner, rw: 207, cw: 207, h: 38, s: !runner.identityCard.hideBrainDamage });
  counterPositionings.push({ e: countersUI.hand_size.runner, rw: 93, cw: 85, h: 38, s: !runner.identityCard.hideHandSize });
  var counterUIWOffset = 0;
  for (var i=0; i<counterPositionings.length; i++) {
	  if (!counterPositionings[i].s) {
		counterPositionings[i].e.SetPosition(-100, -100); //moved off-screen for basic tutorial game  //hide offscreen
	  }
	  else {
		  if (viewingPlayer == runner) counterUIWOffset += counterPositionings[i].rw;
		  else counterUIWOffset += counterPositionings[i].cw;
		  counterPositionings[i].e.SetPosition(guiWOffset + counterUIWOffset, h - counterPositionings[i].h - runnerFooterHeight);
		  guiWOffset -= guiWSpacingModifier;
	  }
  }
  /* **OLD UI PLACEMENT **
  countersUI.credits.runner.SetPosition(
    guiWOffset + 40,
    h - 40 - runnerFooterHeight
  );
  guiWOffset -= guiWSpacingModifier;
  countersUI.click.runner.SetPosition(
    guiWOffset + 110,
    h - 40 - runnerFooterHeight
  );
  runner._renderOnlyMU = MemoryUnits() - InstalledMemoryCost();
  //basic tutorial game has different ui placement
  if (runner.identityCard.hideTags) {
    guiWOffset -= guiWSpacingModifier;
    countersUI.tag.runner.SetPosition(guiWOffset + 209, h + 100); //moved off-screen for basic tutorial game
    guiWOffset -= guiWSpacingModifier;
    countersUI.mu.runner.SetPosition(
      guiWOffset + 207,
      h - 38 - runnerFooterHeight
    ); //moved across for basic tutorial game
    guiWOffset -= guiWSpacingModifier;
    countersUI.brain_damage.runner.SetPosition(guiWOffset + 384, h + 100); //moved off-screen for basic tutorial game
  } //standard ui
  else {
    guiWOffset -= guiWSpacingModifier;
    countersUI.tag.runner.SetPosition(
      guiWOffset + 200,
      h - 39 - runnerFooterHeight
    );
    guiWOffset -= guiWSpacingModifier;
    countersUI.mu.runner.SetPosition(
      guiWOffset + 301,
      h - 38 - runnerFooterHeight
    );
    //guiWOffset -= guiWSpacingModifier;
    //countersUI.brain_damage.runner.SetPosition(guiWOffset+384,h-38-runnerFooterHeight);
    countersUI.brain_damage.runner.SetPosition(guiWOffset + 384, h + 100); //moved off-screen (System Gateway doesn't have brain damage)
  }
  guiWOffset -= guiWSpacingModifier;
  countersUI.hand_size.runner.SetPosition(
    guiWOffset + 384,
    h - 38 - runnerFooterHeight
  );
  */
  runner._renderOnlyHandSize = MaxHandSize(runner);
  countersUI.hand_size.runner.prefix = runner.grip.length + "/";
  countersUI.hand_size.runner.richText.text =
    countersUI.hand_size.runner.prefix + runner._renderOnlyHandSize;
  cardRenderer.ShowParticleContainers();

  //keep installing card where it was dropped by storing it here and restoring it after apply of cascades
  //part 2 of 2: restore
  for (var i = 0; i < corp.installingCards.length; i++) {
    var installingCard = corp.installingCards[i];
    installingCard.renderer.destinationPosition.x =
      installingCard.renderer.temporaryStorage.x;
    installingCard.renderer.destinationPosition.y =
      installingCard.renderer.temporaryStorage.y;
    installingCard.renderer.faceUp =
      installingCard.renderer.temporaryStorage.faceUp;
  }
  for (var i = 0; i < runner.installingCards.length; i++) {
    var installingCard = runner.installingCards[i];
    installingCard.renderer.destinationPosition.x =
      installingCard.renderer.temporaryStorage.x;
    installingCard.renderer.destinationPosition.y =
      installingCard.renderer.temporaryStorage.y;
    installingCard.renderer.faceUp =
      installingCard.renderer.temporaryStorage.faceUp;
  }

  UpdateCounters();

  //update pile counts
  cardRenderer.pileRnDText.text = corp.RnD.cards.length;
  if (viewingPlayer == corp) {
    cardRenderer.pileRnDText.rotation = Math.PI;
    cardRenderer.pileRnDText.x = 0.5 * (corp.RnD.xStart + corp.RnD.xEnd) + 70;
    cardRenderer.pileRnDText.y = corp.RnD.yCards + 201;
  } //runner
  else {
    cardRenderer.pileRnDText.x = 0.5 * (corp.RnD.xStart + corp.RnD.xEnd) - 70;
    cardRenderer.pileRnDText.y = corp.RnD.yCards + 24;
  }
  cardRenderer.pileStackText.text = runner.stack.length;
  if (viewingPlayer == corp) {
    cardRenderer.pileStackText.rotation = Math.PI;
    cardRenderer.pileStackText.x =
      0.5 * (runner.stack.xStart + runner.stack.xEnd) + 70;
    cardRenderer.pileStackText.y = runner.stack.yCards - 23;
  } //runner
  else {
    cardRenderer.pileStackText.x =
      0.5 * (runner.stack.xStart + runner.stack.xEnd) - 70;
    cardRenderer.pileStackText.y = runner.stack.yCards - 200;
  }

  for (var i = 0; i < zoomedCards.length; i++) {
    //just unzoom and rezoom to reset
	var savedStoredPos = zoomedCards[i].renderer.storedPosition.y; //save and...
	var savedStoredRot = zoomedCards[i].renderer.storedRotation;
    zoomedCards[i].renderer.ToggleZoom();
    zoomedCards[i].renderer.ToggleZoom();
	zoomedCards[i].renderer.storedPosition.y = savedStoredPos; //restore to prevent glitch
	zoomedCards[i].renderer.storedRotation = savedStoredRot;
  }

  //highlight approached/encountered ice
  if (approachIce > -1) {
    glow = 0; //by default assume approaching
    if (movement) glow = 3;
    //movement
    else if (CheckEncounter()) {
      glow = 1; //encountering
      var installedCards = InstalledCards(runner);
      for (var i = 0; i < installedCards.length; i++) {
        var card = installedCards[i];
        if (CheckSubType(card, "Icebreaker")) {
          if (CheckStrength(card)) glow = 2; //interfacing
        }
      }
    }
    if (approachIce < attackedServer.ice.length)
      cardRenderer.UpdateGlow(attackedServer.ice[approachIce].renderer, glow);
  } else if (attackedServer != null && attackedServerGlow.x !== 0) {
    cardRenderer.UpdateGlow(
      null,
      1,
      attackedServerGlow.x,
      attackedServerGlow.y
    );
  } else cardRenderer.UpdateGlow(null, 0);
  
  //update actual rendered view (this would eventually be done automatically but this can cause issues with hover detection out of sync
  cardRenderer.app.render(cardRenderer.app.stage);
}

var counterList = ["advancement", "credits", "virus", "power", "agenda"]; //used for resetting all counters on a card, setting them up for render, etc.
var countersUI = {
  credits: {},
  click: {},
  tag: {},
  mu: {},
  advancement: {},
  virus: {},
  power: {},
  agenda: {},
  brain_damage: {},
  bad_publicity: {},
  hand_size: {},
};

//Prepare game for play
var skipShuffleAndDraw = false;
function Setup() {
  activePlayer = corp;

  countersUI.credits.texture = cardRenderer.LoadTexture("images/credit.png");
  countersUI.click.texture = cardRenderer.LoadTexture("images/click.png");
  countersUI.tag.texture = cardRenderer.LoadTexture("images/tag.png");
  countersUI.mu.texture = cardRenderer.LoadTexture("images/mu.png");
  countersUI.bad_publicity.texture = cardRenderer.LoadTexture(
    "images/bad_publicity.png"
  );
  countersUI.advancement.texture = cardRenderer.LoadTexture(
    "images/advancement.png"
  );
  countersUI.virus.texture = cardRenderer.LoadTexture("images/generic_red.png");
  countersUI.power.texture = cardRenderer.LoadTexture(
    "images/generic_purple.png"
  );
  countersUI.agenda.texture = cardRenderer.LoadTexture(
    "images/generic_purple.png"
  );
  countersUI.brain_damage.texture = cardRenderer.LoadTexture(
    "images/brain_damage.png"
  );
  countersUI.hand_size.texture = cardRenderer.LoadTexture(
    "images/hand_size.png"
  );

  countersUI.credits.corp = cardRenderer.CreateCounter(
    countersUI.credits.texture,
    corp,
    "creditPool",
    0.5,
    false,
    ResolveClick
  );
  countersUI.credits.runner = cardRenderer.CreateCounter(
    countersUI.credits.texture,
    runner,
    "creditPool",
    0.5,
    false,
    ResolveClick
  );
  countersUI.click.corp = cardRenderer.CreateCounter(
    countersUI.click.texture,
    corp,
    "clickTracker",
    0.5,
    false
  );
  countersUI.click.runner = cardRenderer.CreateCounter(
    countersUI.click.texture,
    runner,
    "clickTracker",
    0.5,
    false
  );
  countersUI.hand_size.corp = cardRenderer.CreateCounter(
    countersUI.hand_size.texture,
    corp,
    "_renderOnlyHandSize",
    0.5,
    false
  );
  countersUI.hand_size.runner = cardRenderer.CreateCounter(
    countersUI.hand_size.texture,
    runner,
    "_renderOnlyHandSize",
    0.5,
    false
  );
  countersUI.tag.runner = cardRenderer.CreateCounter(
    countersUI.tag.texture,
    runner,
    "tags",
    0.5,
    false,
    ResolveClick
  );
  countersUI.mu.runner = cardRenderer.CreateCounter(
    countersUI.mu.texture,
    runner,
    "_renderOnlyMU",
    0.5,
    false
  );
  countersUI.bad_publicity.corp = cardRenderer.CreateCounter(
    countersUI.bad_publicity.texture,
    corp,
    "badPublicity",
    0.5,
    false
  );
  /*
  countersUI.brain_damage.runner = cardRenderer.CreateCounter(
    countersUI.brain_damage.texture,
    runner,
    "brainDamage",
    0.5,
    false
  );
  */

  LoadDecks();
  corp.identityCard.faceUp = true;
  runner.identityCard.faceUp = true;
  if (typeof corp.identityCard.Tutorial !== "undefined")
    corp.identityCard.Tutorial.call(corp.identityCard, "");
  //blank string means game initialisation
  else if (typeof runner.identityCard.Tutorial !== "undefined")
    runner.identityCard.Tutorial.call(runner.identityCard, "");
  //blank string means game initialisation
  else if (!skipShuffleAndDraw) {
    //normal play mode (non-tutorial)
    Shuffle(corp.RnD.cards);
    Shuffle(runner.stack);
    Log("Decks shuffled");
    corp.creditPool = 5;
    runner.creditPool = 5;
  }

  if (viewingPlayer == corp) {
    cardRenderer.ChangeSide();
    UpdateCounters(); //rotate the text to be the right way up
  }

  //move all cards into starting positions
  Render();
  ApplyToAllCards(function (card) {
    card.renderer.sprite.x = card.renderer.destinationPosition.x;
    card.renderer.sprite.y = card.renderer.destinationPosition.y;
  });

  //wait for textures to load (will call StartGame which calls Main)
}

function StartGame() {
  if (!skipShuffleAndDraw) {
    for (
      var i = 0;
      i < 5;
      i++ //no need to call triggers because no cards are active during setup
    ) {
      MoveCardByIndex(corp.RnD.cards.length - 1, corp.RnD.cards, corp.HQ.cards);
      MoveCardByIndex(runner.stack.length - 1, runner.stack, runner.grip);
    }
    Log("Each player has taken five credits and drawn five cards");
	
	//Narrate();
	stackedLog = []; //skip narration
	
    IncrementPhase();
  }
  Render(); //to show cards have moved from decks
  Main();
}

var TutorialReplacer = null;
var TutorialWhitelist = null;
var TutorialBlacklist = null;
var TutorialCommandMessage = {};
function TutorialMessage(message, prompt = false, callback=null) {
  cardRenderer.tutorialText.text = message;
  if (prompt) {
    var decisionPhase = DecisionPhase(
      viewingPlayer,
      [{}],
      function () {
        cardRenderer.tutorialText.text = "";
        TutorialReplacer = null;
		if (callback) callback();
      },
      "Tutorial",
      "",
      this
    );
    decisionPhase.requireHumanInput = true;
  }
}

function NicelyFormatCommand(cmdstr) {
  //console.log(cmdstr+" at "+currentPhase.identifier);
  if (cmdstr == "n") {
    if (accessList.length > 1) cmdstr = "Next";
    else if (accessingCard != null) cmdstr = "End";
    else if (currentPhase.title == "Trash Before Install") {
      cmdstr = "Finish install (trash no more cards)";
    } else if (currentPhase.identifier == "Run 2.2") {
      if (attackedServer.ice[approachIce].rezzed)
        cmdstr = "Continue to Encounter Phase";
      else cmdstr = "Continue to Movement Phase";
    } else if (currentPhase.identifier == "Run 3.1") {
      if (ChoicesEncounteredSubroutines().length > 0)
        cmdstr = "Resolve unbroken subroutines";
      else cmdstr = "Continue";
    } else if (currentPhase.identifier == "Run 4.5") {
      if (viewingPlayer == corp) {
        if (approachIce > 0) cmdstr = "Continue to Approach Ice Phase";
        else cmdstr = "Continue to Success Phase";
      } else cmdstr = "Approach";
    } else if (
      viewingPlayer == corp &&
      currentPhase.identifier == "Runner 2.2"
    ) {
      //for usability when human playing Corp
      if (corp.AI == null) {
        cmdstr = "Begin turn";
        phases.corpStartDraw.corpSkip = true;
      } else cmdstr = "End of Runner's turn";
    } else if (viewingPlayer == corp && currentPhase.identifier == "Corp 1.1")
      cmdstr = "Begin turn";
    else if (currentPhase.identifier == "Corp 2.1")
      cmdstr = "Continue to first action";
    else if (
      currentPhase.identifier == "Corp 2.2" ||
      currentPhase.identifier == "Corp 2.2*"
    ) {
      //would just be 2.2* except for the phase-combining
      if (corp.clickTracker < 1) {
        //for usability when human playing Corp
        if (corp.AI == null && corp.HQ.cards.length <= MaxHandSize(corp)) {
          cmdstr = "End turn";
          phases.corpDiscardResponse.corpSkip = true;
        } else cmdstr = "Continue to Discard Phase";
      } else cmdstr = "Continue to next action";
    } else if (viewingPlayer == corp && currentPhase.identifier == "Corp 3.2")
      cmdstr = "End turn";
    else if (typeof phaseOptions.m !== "undefined") cmdstr = "Keep";
    else cmdstr = "Continue";
  } else if (cmdstr == "m") cmdstr = "Mulligan";
  else if (cmdstr == "jack") cmdstr = "Jack out";

  return cmdstr.charAt(0).toUpperCase() + cmdstr.slice(1);
}

var mainLoop;
var mainLoopDelay = 350;
function Main() {
  var optionList = EnumeratePhase();
  var chosenCommand = null;
  var autoExecute = optionList.length == 1;
  if (autoExecute && currentPhase.requireHumanInput && activePlayer.AI == null)
    autoExecute = false; //special case if active player is human-controlled
  if (autoExecute) ExecuteChosen(optionList[0]);
  else if (activePlayer.AI != null) {
    try {
      ExecuteChosen(optionList[activePlayer.AI.CommandChoice(optionList)]); //active player is AI controlled
    } catch (e) {
      LogError(e);
      Log("AI: Error executing command choice, using arbitrary option from:");
      console.log(optionList);
      ExecuteChosen(optionList[0]);
    }
  } else if (activePlayer.testAI != null) {
    //say what the AI would have done if it was playing
    console.log(
      "AI would have chosen: " +
        JSON.stringify(
          optionList[activePlayer.testAI.CommandChoice(optionList)]
        )
    );
  }
}

function ExecuteChosen(chosenCommand) {
  if (chosenCommand != null) {
    if (TutorialReplacer != null) {
      if (TutorialReplacer(chosenCommand)) return; //replaced by tutorial response
    }

    var footerText = NicelyFormatCommand(chosenCommand);
    if (typeof currentPhase.text !== "undefined") {
      if (typeof currentPhase.text[chosenCommand] !== "undefined") {
        footerText = currentPhase.text[chosenCommand];
      }
    }

    //have decided I prefer to not show the resolving text as it might just confuse the user (it usually said "Continue")
    //except where it will be useful for the player to have an instruction
    var oldFooterText = footerText;
    footerText = "";
    if (viewingPlayer == activePlayer) {
      if (activePlayer == runner) {
        if (oldFooterText == "Access") footerText = "Access cards";
        else if (oldFooterText == "Discard") footerText = "Drag to your heap";
      } //corp
      else {
        if (oldFooterText == "Discard") footerText = "Drag to Archives";
        else if (oldFooterText == "Trash") footerText = "Choose card to trash";
        else if (oldFooterText == "Drag to R&D") footerText = oldFooterText;
      }
    }

    $("#footer").html("<h2>" + footerText + "</h2>");

    Execute(chosenCommand);

    //check win by agenda points
    if (AgendaPoints(corp) >= AgendaPointsToWin())
      PlayerWin(
        corp,
        "Corp has reached " + AgendaPointsToWin() + " agenda points"
      );
    else if (AgendaPoints(runner) >= AgendaPointsToWin())
      PlayerWin(
        runner,
        "Runner has reached " + AgendaPointsToWin() + " agenda points"
      );
    else LogDebug("Updating phase after " + chosenCommand);

    var triggerList = AutomaticTriggers("anyChange");

    Render();
  } else {
    LogError("Null command");
    $("#footer").html("");
  }
}
