<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>Chiriboga Deck Launcher</title>
		<link href="images/favicon.ico" rel="icon">
		<link rel="stylesheet" href="jquery/jquery-ui.css" />
		<link rel="stylesheet" href="style.css" />
		<link rel="manifest" href="manifest.json">
		<?php
		include 'cardrenderer/webfont.php';
		?>
		<script src="jquery/jquery-3.2.1.min.js"></script>
		<script src="jquery/jquery-ui.min.js"></script>
		<script src="jquery/textarea-helper.js"></script>
		<script src="deck/lz-string.min.js"></script>
		<script src="deck/seedrandom.min.js"></script>
		<script>
			//create some variables so we can load the card definitions
			var runner = {};
			var corp = {};
			var cardSet = []; //prepare to receive card definitions
			var setIdentifiers = []; //set identifiers
		</script>
		<?php
		echo '<script src="utility.js?' . filemtime('utility.js') . '"></script>';
		
		$sets = ["systemgateway","systemupdate2021"];
		if (isset($_GET['sets'])) {
			$sets = explode("-",preg_replace( "/[^a-zA-Z0-9-]/", "", $_GET['sets'] )); 
		}
		foreach ($sets as $set) {
			echo '<script src="sets/'.$set.'.js?' . filemtime('sets/'.$set.'.js') . '"></script>';
		}
		
		?>
		<script>
			var json = {};
			var opponentdeckstr = "";
			var opponentdeckimg = "";
			var uid = 0;

			function IdentityImageFromDeckString(compressed) {
				var oppjson = JSON.parse(
				  LZString.decompressFromEncodedURIComponent(compressed)
				);
				opponentdeckimg = "images/"+cardSet[oppjson.identity].imageFile;
			}

			var deckPlayer = corp;
			if (URIParameter("r") !== "" && URIParameter("p") !== "c") {
				deckPlayer = runner;
				var uric = URIParameter("c");
				if (uric) {
					opponentdeckstr = "c="+uric+"&";
					IdentityImageFromDeckString(uric);
				}					
			} else {
				var urir = URIParameter("r")
				if (urir) {
					opponentdeckstr = "r="+urir+"&";
					IdentityImageFromDeckString(urir);
				}
			}

			//generate available titles
			var titles = [];
			for (var i=0; i<cardSet.length; i++) {
				if (typeof cardSet[i] !== "undefined") {
					if (cardSet[i].player == deckPlayer && cardSet[i].cardType != 'identity') { 
						var setCardTitle = cardSet[i].title;
						titles.push(setCardTitle);
					}
				}
			}
			titles.sort();

			function WordAtCursor(remove=false) {
				var text = $(this).val();
				var start = $(this)[0].selectionStart - 1;
				var end = $(this)[0].selectionEnd;
				while (start > 0) {
					if (text[start] != "\n") {
						--start;
					} else {
						break;
					}                        
				}
				if (start > 0) ++start;
				while (end < text.length) {
					if (text[end] != "\n") {
						++end;
					} else {
						break;
					}
				}
				var currentWord = text.substr(start, end - start);
				if (remove) {
					$(this).val(text.slice(0, start)+text.slice(end));
					$(this)[0].selectionStart = start;
				}
				return currentWord;
			}

			function extractTerm( term ) {
			  //extract the term at current position
			  var wordAtCursor = WordAtCursor.call($("#deck"));
			  var justTheWord = wordAtCursor.match(/(\d* *)(.*)/)[2]; //actually the word can be multiple words
			  return justTheWord;
			}

			var dC = "r"; //deckchar is r for runner
			var oC = "c"; //opponentchar is c for corp
			if (deckPlayer == corp) {
				dC = "c"; //deckchar is c for corp
				oC = "r"; //opponentchar is r for runner
			}
			var setStr = "";
			if (URIParameter("sets") !== "") setStr = "sets="+URIParameter("sets")+"&";

			var playerIdentities = [];
			for (var i=0; i<cardSet.length; i++) {
				if (typeof cardSet[i] != 'undefined' &&  typeof cardSet[i].faction != 'undefined') {
					if (cardSet[i].cardType == 'identity') {
						if (deckPlayer == cardSet[i].player) playerIdentities.push(i);
					}
				}
			}

			function UpdateLaunchStrings() {
			  //console.log(json);
			  var string = JSON.stringify(json);
			  var compressed = LZString.compressToEncodedURIComponent(string);
			  var launchAddress = "engine.php?p=" + dC + "&" + setStr + opponentdeckstr + dC + "=" + compressed;
			  var opponentAddress = "decklauncher.php?p=" + oC + "&" + setStr + oC + "=random&" + dC + "=" + compressed;
			  $("#launch").prop("href", launchAddress);
			  $("#opponent").prop("href", opponentAddress);
			  history.replaceState(
				null,
				"Chiriboga",
				"decklauncher.php?" + setStr + opponentdeckstr + dC + "=" + compressed
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
				var cardsChosen = DeckBuild(cardSet[json.identity]);
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
			  //set up autosuggest
			  var autoMinLen = 1;
			  $("#deck").on("keydown", function (event) {
				if (event.which == 13) {
					//enter key
					$(this).autocomplete("option", "minLength", Infinity);
					return;
				}
				//known issue: this leaps to strange places when it is too large to fit onscreen...
				var newY = $(this).textareaHelper('caretPos').top + (parseInt($(this).css('font-size'), 10) * 1.5);
				var newX = $(this).textareaHelper('caretPos').left;
				var posString = "left+" + newX + "px top+" + newY + "px";
				$(this).autocomplete("option", "position", {
					my: "left top",
					at: posString,
					of: $(this),
				});
				var wordAtCursor = WordAtCursor.call($("#deck"));
				var minLen = $(this).val().length - wordAtCursor.length + autoMinLen; //since length check tests shole textarea
				var coefficient = wordAtCursor.match(/(\d* *)(.*)/)[1];
				if (coefficient) minLen += coefficient.length;
				$(this).autocomplete("option", "minLength", minLen);
			  });

			  $("#deck").autocomplete({
				minLength: autoMinLen,
				open: function( event, ui ) {
					//prevent up/down arrows from opening the menu
					return false;
				},
				source: function( request, response ) {
				  // delegate back to autocomplete, but extract the relevant term
				  response( $.ui.autocomplete.filter(
					titles, extractTerm( request.term ) ).slice(0,4) ); //limit number of results
				},
				select: function( event, ui ) {
					var wordAtCursor = WordAtCursor.call($("#deck"),true); //true removes it
					var coefficient = wordAtCursor.match(/(\d* *)(.*)/)[1];
					if (!coefficient) coefficient = "";
					var originalText = $(this).val();
					var curPos = $(this)[0].selectionStart;
					var backPart = originalText.slice(curPos);
					if ( backPart.length == 0 || backPart[0] != "\n") {
						backPart = "\n" + backPart;
					}
					$(this).val(originalText.slice(0, curPos)+coefficient+ui.item.value+backPart);
					Parse();
					return false; //prevent default action (would replace whole area)
				},
				autoFocus:true,
				focus: function( event, ui ) {
					return false; //prevent default action (would replace whole area)
				},
				delay:0,
			  });
			  
			  // Overrides the default autocomplete filter function to search only from the beginning of the string
			  $.ui.autocomplete.filter = function (array, term) {
				    term = Normalise(term);
					if (term.length < autoMinLen) array = []; //enforce min length
					var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
					return $.grep(array, function (value) {
						value = Normalise(value);
						return matcher.test(value.label || value.value || value);
					});
			  };
			  
			  //click into list should close the autocomplete
			  $("#deck").on("click",function() {
				  $("#deck").autocomplete("close");
			  });
			  
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

			function Normalise(src) {
				return src.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
			}

			function GetCardIdFromTitle(title) {
			  var soughtCardTitle = Normalise(title);
			  //seek backwards so as to get the most recent version
			  for (var i=cardSet.length; i>-1; i--) {
				if (typeof cardSet[i] !== "undefined") {
				  var setCardTitle = Normalise(cardSet[i].title);
				  if (setCardTitle.length >= soughtCardTitle.length) {
					if (setCardTitle.substring(0,soughtCardTitle.length) === soughtCardTitle) {
						return i;
					}
				  }
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
					  $("#cardcontainer").append(
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
						$("#cardcontainer")
						  .children()
						  .last()
						  .append(
							'<img src="images/' + cardSet[id].imageFile + stylestr + '">'
						  );
					  }
					  Math.seedrandom(storedRandomness); //restore unpredictable randomness
					  $("#cardcontainer").children().last().mousedown(mouseDownCallback);
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
					" cards </span><br><br><span" +
					infstylestr +
					">" +
					totalInfluence +
					" influence</span><br>";
				else
				  validityOutput += totalCards + " card<br><br>" + totalInfluence + " influence<br>";
				if (deckPlayer == corp) {
				  var agendaMin = 2 * Math.floor(Math.max(totalCards,cardSet[json.identity].deckSize) / 5) + 2;
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
					  " required)</span>";
				  else
					validityOutput +=
					  "<br><span" +
					  agpstylestr +
					  ">1 agenda point (" +
					  agendaMin +
					  "-" +
					  agendaMax +
					  " required)</span>";
				}
				$("#output").html(validityOutput);
				$("#launch").prop("disabled", false);
			  }
			  $("#launch").html("Play using this deck");
			  UpdateLaunchStrings();
			  //update opponent image
			  if (opponentdeckimg != "") $("#opponentid").html('Opponent: <img src="'+opponentdeckimg+'"/>');
			}
			
			//function for testing and debugging
			function TestGeneration(seed=0) {
				Math.seedrandom(seed);
				$('#identityselect').change();
				console.log(json.cards);
			}
			function TestGenerationBulk(start=0, end=100) {
				for (var j=start; j<=end; j++) {
					TestGeneration(j);
					//convert generated deck into counts
					var counts = {};
					for (var i = 0; i < json.cards.length; i++) {
						if (typeof counts[json.cards[i]] == 'undefined') counts[json.cards[i]]=1;
						else {
							counts[json.cards[i]]++;
							//report any over-amounts
							if (counts[json.cards[i]] > 3) console.log(j);
						}
					}
				}
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
			  padding:0px;
			  margin:0px;
			}
			
			.button {
			  padding: 15px;
			}
			
			.leftrow.buttons {
				margin-bottom: -15px;
			}
			
			.cardgroup {
				cursor:pointer;
			}
			
			.leftrow {
				padding-left:30px;
			}
			
			.toprow {
				padding-top:30px;
			}
			
			.rightpart {
				display:inline-block;
				vertical-align:top;
				width:160px;
				padding-top:20px;
			}
			
			.ui-widget-content {
				background: #113;
			}
			
			#opponentid {
				margin-top: 20px;
			}
			
			#opponentid img {
				width: 50px;
				margin: 0px;
				vertical-align: middle;
			}
			
		</style>
	</head>


	<body onload="Init();">
		<div id="contentcontainer">
			<div id="dataentry" style="width:400px; float:left; max-height: 100vh; overflow:auto;">
				<div class="leftrow toprow">
					<select id="identityselect" style="max-width: 340px;"></select>
					<img id="identity" src="images/glow_outline.png">
					<div class="rightpart">
						<div id="output">
						</div>
						<div id="opponentid"></div>
					</div>
				</div>
				<div class="leftrow buttons">
					<button id="exittomenu" onclick="window.location.href='index.php';" class="button">Exit</button>
					<button id="launch" class="button" onclick="window.location.href=$(this).prop('href');">Play using this deck</button>
					<button id="randomise" onclick="$('#identityselect').change();" class="button">Randomise</button>
					<button id="opponent" class="button" onclick="window.location.href=$(this).prop('href');">Set as opponent</button>
				</div>
				<div class="leftrow toprow">
					<textarea id="deck" spellcheck="false" cols="30" style="max-width:340px; min-width:340px;"></textarea><br/>
				</div>
				<br/>
			</div>
			<div id="cardcontainer" style="max-height: 100vh; overflow:auto;">
			</div>
		</div>
	</body>
</html>
