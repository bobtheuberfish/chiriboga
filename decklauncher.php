<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>Chiriboga Deck Launcher</title>
		<link href="images/favicon.ico" rel="icon">
		<link rel="stylesheet" href="style.css" />
		<link rel="manifest" href="manifest.json">
		<?php
		include 'cardrenderer/webfont.php';
		?>
		<script src="jquery/jquery-3.2.1.min.js"></script>
		<script src="deck/lz-string.min.js"></script>
		<script src="deck/seedrandom.min.js"></script>
		<script>
			//create some variables so we can load the card definitions
			var runner = {};
			var corp = {};
			var cardSet = []; //prepare to receive card definitions
		</script>
		<?php
		echo '<script src="utility.js?' . filemtime('utility.js') . '"></script>';
		echo '<script src="sets/systemgateway.js?' . filemtime('sets/systemgateway.js') . '"></script>';
		echo '<script src="sets/systemupdate2021.js?' . filemtime('sets/systemupdate2021.js') . '"></script>';
		?>
		<script>
			var json = {};
			var uid = 0;

			var deckPlayer = corp;
			if (URIParameter("r") !== "") deckPlayer = runner;

			if (deckPlayer == corp) dC = "c";
			//deckchar is c for corp
			else dC = "r"; //deckchar is r for runner

			var playerIdentities = [];
			if (deckPlayer == runner) playerIdentities = [30001, 30010, 30019, 31001, 31002, 31013, 31014]; //also in decks.js (TODO move to shared function)
			else playerIdentities = [30035, 30043, 30051, 30059];

			function UpdateLaunchStrings() {
			  //console.log(json);
			  var string = JSON.stringify(json);
			  var compressed = LZString.compressToEncodedURIComponent(string);
			  var launchAddress = "engine.php?" + dC + "=" + compressed;
			  $("#launch").prop("href", launchAddress);
			  history.replaceState(
				null,
				"Chiriboga",
				"decklauncher.php?" + dC + "=" + compressed
			  );
			}

			var mouseDownCallback = function (ev) {
			  if (ev.which == 3) {
				//right
				var id = parseInt($(this).attr("data-id"));
				var line = parseInt($(this).attr("data-line"));
				var deckListArray = $("#deck").val().split("\n");
				var thisLineArray = deckListArray[line].split(" ");
				//if (thisLineArray[0] < 3) //limit to 3 of each
				//{
				thisLineArray[0]++;
				deckListArray[line] = thisLineArray.join(" ");
				$("#deck").val(deckListArray.join("\n"));
				$(this).append(
				  '<img src="images/' +
					cardSet[id].imageFile +
					'" style="margin-left: -120px; transform:rotate(' +
					(Math.random() * 10 - 5) +
					'deg);">'
				);
				json.cards.push(id); //just on the end is fine
				Parse();
				//}
			  }
			  if (ev.which == 1) {
				//left
				var id = parseInt($(this).attr("data-id"));
				var line = parseInt($(this).attr("data-line"));
				$(this).children().last().remove();
				var deckListArray = $("#deck").val().split("\n");
				var thisLineArray = deckListArray[line].split(" ");
				thisLineArray[0]--;
				if (thisLineArray[0] < 1) {
				  //none left, this will invalidate some data-line
				  $(".cardgroup").each(function () {
					var thisLine = parseInt($(this).attr("data-line"));
					if (thisLine > line) $(this).attr("data-line", thisLine - 1);
				  });
				  deckListArray.splice(line, 1);
				} else deckListArray[line] = thisLineArray.join(" ");
				$("#deck").val(deckListArray.join("\n"));
				json.cards.splice(json.cards.indexOf(id), 1); //remove the first-found is fine
				Parse();
			  }
			};

			function GenerateDeck() {
			  var playerCards = [];
			  var countSoFar = []; //of each card (by index in playerCards)

			  //LOAD deck, if specified (as an LZ compressed JSON object containing .identity= and .cards=[], wth cards specified by number in the set)
			  var specifiedPlayerDeck = URIParameter(dC);
			  if (specifiedPlayerDeck != "" && specifiedPlayerDeck != "random") {
				json = JSON.parse(
				  LZString.decompressFromEncodedURIComponent(specifiedPlayerDeck)
				);
				if (typeof json.cards == 'undefined') json.cards = [];
				//support legacy (gateway) format by looping through .systemGateway and converting to 30000 + set number
				if (typeof json.systemGateway !== 'undefined') {
					for (var i=0; i<json.systemGateway.length; i++) {
						json.cards.push(30000+parseInt(json.systemGateway[i]));
					}
				}
				//also update the identity if it is legacy
				if (parseInt(json.identity) < 10001) json.identity = parseInt(json.identity) + 30000;
				//update select
				$("#identityselect option[value=" + json.identity + "]").prop(
				  "selected",
				  "selected"
				);
				$("#identity").prop(
				  "src",
				  "images/" + cardSet[json.identity].imageFile
				);
				for (var i = 0; i < json.cards.length; i++) {
			      //increment count, add to playerCards if not present yet
			      var pci = playerCards.indexOf(json.cards[i]);
				  if (pci < 0) {
					pci = playerCards.length;
					playerCards.push(json.cards[i]);
					countSoFar[pci] = 1;
				  }
				  else countSoFar[pci]++;
				}
			  } //create a random deck for this identity
			  else {
				var cardsChosen = DeckBuild(cardSet[json.identity],["sg","su21"]);
				//convert generated deck into counts
				for (var i = 0; i < cardsChosen.length; i++) {
				  var pci = playerCards.indexOf(cardsChosen[i]);
				  if (pci < 0) {
					pci = playerCards.length;
					playerCards.push(cardsChosen[i]);
					countSoFar[pci] = 1;
				  }
				  else countSoFar[pci]++;
				}	  
			  }

			  //print into textarea
			  var deckText = "";
			  var numRows = 0;
			  for (var i = 0; i < countSoFar.length; i++) {
				if (countSoFar[i] > 0) {
				  if (numRows > 0) deckText += "\n";
				  deckText += countSoFar[i] + " " + cardSet[playerCards[i]].title;
				  numRows++;
				}
			  }
			  $("#deck").val(deckText);
			  $("#deck").prop("rows", numRows); //resize textarea height to fit
			  $("#deck").on("input propertychange paste", Parse);
			  Parse();
			}

			function Init() {
			  //identity select will regenerate a deck if changed
			  $("#identityselect").change(function () {
				json.identity = $("select#identityselect option:checked").val();
				$("#identity").prop(
				  "src",
				  "images/" + cardSet[json.identity].imageFile
				);
				history.pushState(null, "Chiriboga", "decklauncher.php"); //so a random deck is generated
				GenerateDeck();
			  });

			  //set up identity select
			  for (var i = 0; i < playerIdentities.length; i++) {
				$("#identityselect").append(
				  "<option value=" +
					playerIdentities[i] +
					">" +
					cardSet[playerIdentities[i]].title +
					"</option>\n"
				);
			  }
			  //choose an identity at random, unless a load string was specified
			  var specifiedPlayerDeck = URIParameter(dC);
			  if (specifiedPlayerDeck == "" || specifiedPlayerDeck == "random") {
				var randomIdentity =
				  playerIdentities[RandomRange(0, playerIdentities.length - 1)];
				$("#identityselect option[value=" + randomIdentity + "]")
				  .prop("selected", "selected")
				  .change(); //calling change also means a deck will be generated
			  } else GenerateDeck(); //this will recognise the input string and load it
			}

			function GetCardIdFromTitle(title) {
			  var soughtCardTitle = title
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase();
			  //seek backwards so as to get the most recent version
			  for (var i=cardSet.length; i>-1; i--) {
				if (typeof cardSet[i] !== "undefined") {
				  var setCardTitle = cardSet[i].title
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.toLowerCase();
				  if (setCardTitle === soughtCardTitle) return i;
				}
			  }
			  return -1;
			}

			function Parse() {
			  //disable launch while checking
			  $("#launch").prop("disabled", "disabled");
			  $("#launch").html("Checking...");
			  $("#output").html("");
			  $(".cardgroup").remove();

			  //read the textarea and create the deck
			  var validDeck = true;
			  var totalCards = 0;
			  var totalInfluence = 0;
			  var totalAgendaPoints = 0; //only for corp
			  var outputLine = 0;
			  json.cards = [];
			  var splitText = $("#deck").val().split("\n");
			  for (var i = 0; i < splitText.length; i++) {
				var cardCount = 0;
				var cardTitle = "";
				var splitLine = splitText[i].split(" ");
				if (splitLine.length == 1) {
				  cardCount = 1;
				  cardTitle = splitLine[0];
				} else if (splitLine.length > 1) {
				  cardCount = parseInt(splitLine[0]);
				  cardTitle = splitLine.slice(1).join(" ");
				}
				if (cardCount > 0 && cardTitle != "") {
				  var id = GetCardIdFromTitle(cardTitle);
				  if (id > -1) {
					if (cardSet[id].player == deckPlayer) {
					  $("#contentcontainer").append(
						'<div id="cg-' +
						  uid++ +
						  '" class="cardgroup" style="float:left;" data-id="' +
						  id +
						  '" data-line="' +
						  outputLine +
						  '" oncontextmenu="return false"></div>'
					  );
					  //the seed random is just to keep card rotations consistent
					  //we need to restore randomness afterwards, so we'll store a random number to use as seed
					  var storedRandomness = Math.random();
					  Math.seedrandom(id);
					  for (var j = 0; j < cardCount; j++) {
						totalCards++;
						if (cardSet[id].faction !== cardSet[json.identity].faction)
						  totalInfluence += cardSet[id].influence;
						if (
						  deckPlayer == corp &&
						  typeof cardSet[id].agendaPoints !== "undefined"
						)
						  totalAgendaPoints += cardSet[id].agendaPoints;
						json.cards.push(id);
						var stylestr = "";
						if (j > 0)
						  stylestr =
							'" style="margin-left: -120px; transform:rotate(' +
							(Math.random() * 10 - 5) +
							"deg);";
						$("#contentcontainer")
						  .children()
						  .last()
						  .append(
							'<img src="images/' + cardSet[id].imageFile + stylestr + '">'
						  );
					  }
					  Math.seedrandom(storedRandomness); //restore unpredictable randomness
					  $("#contentcontainer").children().last().mousedown(mouseDownCallback);
					  outputLine++;
					} else {
					  if (deckPlayer == runner)
						$("#output").append(cardTitle + " is not a Runner card<br/>");
					  else $("#output").append(cardTitle + " is not a Corp card<br/>");
					  validDeck = false;
					}
				  } else {
					$("#output").append(cardTitle + " not found<br/>");
					validDeck = false;
				  }
				}
			  }
			  //done checking, permit launch if valid
			  if (validDeck) {
				var validityOutput = "";
				numstylestr = "";
				if (totalCards < cardSet[json.identity].deckSize) numstylestr = ' style="color:red;"';
				infstylestr = "";
				if (totalInfluence > cardSet[json.identity].influenceLimit) infstylestr = ' style="color:red;"';
				if (totalCards !== 1)
				  validityOutput +=
					"<span" +
					numstylestr +
					">" +
					totalCards +
					" cards </span><span" +
					infstylestr +
					">(" +
					totalInfluence +
					" influence)</span>";
				else
				  validityOutput += totalCards + " card (" + totalInfluence + " influence)";
				if (deckPlayer == corp) {
				  var agendaMin = 2 * Math.floor(totalCards / 5) + 2;
				  var agendaMax = agendaMin + 1;
				  agpstylestr = "";
				  if (totalAgendaPoints < agendaMin || totalAgendaPoints > agendaMax)
					agpstylestr = ' style="color:red;"';
				  if (totalAgendaPoints !== 1)
					validityOutput +=
					  "<br><span" +
					  agpstylestr +
					  ">" +
					  totalAgendaPoints +
					  " agenda points (" +
					  agendaMin +
					  "-" +
					  agendaMax +
					  ")</span>";
				  else
					validityOutput +=
					  "<br><span" +
					  agpstylestr +
					  ">1 agenda point (" +
					  agendaMin +
					  "-" +
					  agendaMax +
					  ")</span>";
				}
				$("#output").html(validityOutput);
				$("#launch").prop("disabled", false);
			  }
			  $("#launch").html("Launch");
			  UpdateLaunchStrings();
			}
		</script>
		<style>
			img {
				width: 144px;
				margin: 15px;
			}
			
			body {
			  background:#354149;
			  background-image: url('images/bg.jpg');
			  background-size:cover;
			}
			
			.button {
				margin-bottom: -15px;
			}
			
			.cardgroup {
				cursor:pointer;
			}
		</style>
	</head>


	<body onload="Init();">
		<div id="contentcontainer">
			<div id="dataentry" style="width:440px; float:left; padding:30px;">
				<select id="identityselect"></select>
				<img id="identity" src="images/glow_outline.png">
				<textarea id="deck" spellcheck="false" cols="30"></textarea><br/>
				<div id="output"></div><br/>
				<button id="exittomenu" onclick="window.location.href='index.html';" class="button">Exit to main menu</button>
				<button id="launch" class="button" onclick="window.location.href=$(this).prop('href');">Launch</a>
			</div>
		</div>
	</body>
</html>
