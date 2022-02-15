//CARDRENDERER
//Ideally we would remove the object 'namespace' encapsulation and CardRenderer. references and instead use export/import
//I did have it like that at first but my current project has a bunch of old non-module scripts and the two approaches weren't playing nicely

var CardRenderer = {
  //pile the cards on top of each other. first is on bottom of pile.
  Cascade: class {
    constructor(cards, xStep, yStep, hostingX, faceDownOffset = 0) {
      this.cards = cards;
      this.xStep = xStep;
      this.yStep = yStep;
      var xOffset = 0;
      var yOffset = 0;
      this.extents = { l: 0, r: 0, t: 0, b: 0 }; //relative to the anchor of the first card
      for (var i = 0; i < this.cards.length; i++) {
        var cardExtents = this.cards[i].Extents();
        if (!this.cards[i].faceUp) {
          cardExtents.t += faceDownOffset;
          cardExtents.b += faceDownOffset;
        }
        if (xOffset + cardExtents.l < this.extents.l)
          this.extents.l = xOffset + cardExtents.l;
        if (xOffset + cardExtents.r > this.extents.r)
          this.extents.r = xOffset + cardExtents.r;
        if (yOffset + cardExtents.t < this.extents.t)
          this.extents.t = yOffset + cardExtents.t;
        if (yOffset + cardExtents.b > this.extents.b)
          this.extents.b = yOffset + cardExtents.b;
        //also include hostedCards
        var card = this.cards[i].card;
        if (typeof card.hostedCards !== "undefined") {
          for (var j = 0; j < card.hostedCards.length; j++) {
            if (card.player == corp) {
              xOffset -= hostingX;
              yOffset += hostingX;
            } else {
              xOffset += hostingX;
              yOffset -= hostingX;
            }
            var hostedCardExtents = card.hostedCards[j].renderer.Extents();
            if (xOffset + hostedCardExtents.l < this.extents.l)
              this.extents.l = xOffset + hostedCardExtents.l;
            if (xOffset + hostedCardExtents.r > this.extents.r)
              this.extents.r = xOffset + hostedCardExtents.r;
            if (yOffset + hostedCardExtents.t < this.extents.t)
              this.extents.t = yOffset + hostedCardExtents.t;
            if (yOffset + hostedCardExtents.b > this.extents.b)
              this.extents.b = yOffset + hostedCardExtents.b;
          }
        }
        xOffset += this.xStep;
        yOffset += this.yStep;
      }
      this.width = this.extents.r - this.extents.l;
      this.height = this.extents.b - this.extents.t;
    }

    Apply(
      app,
      x,
      y,
      anchorX,
      anchorY,
      hostingX,
      faceDownOffset = 0 //anchor relates the Cascade position to its extents (default puts anchor at anchor of first card)
    ) {
      var xOffset = x;
      var yOffset = y;
      //s.t. if anchorX = 0, xOffset = -this.extents.l and if anchorX = 1, xOffset = -this.extents.r
      if (typeof anchorX !== "undefined")
        xOffset -= this.width * anchorX + this.extents.l;
      if (typeof anchorY !== "undefined")
        yOffset -= this.height * anchorY + this.extents.t;

      for (var i = 0; i < this.cards.length; i++) {
        app.stage.removeChild(this.cards[i].sprite);
        app.stage.removeChild(this.cards[i].glowSprite);
        this.cards[i].destinationPosition.x = xOffset;
        var extraOffset = 0;
        if (!this.cards[i].faceUp) extraOffset = faceDownOffset;
        this.cards[i].destinationPosition.y = yOffset + extraOffset;
        app.stage.addChild(this.cards[i].glowSprite); //glow immediately under this card
        app.stage.addChild(this.cards[i].sprite);
        //also include hostedCards
        var card = this.cards[i].card;
        if (typeof card.hostedCards !== "undefined") {
          for (var j = 0; j < card.hostedCards.length; j++) {
            if (card.player == corp) {
              xOffset -= hostingX;
              yOffset += hostingX;
            } else {
              xOffset += hostingX;
              yOffset -= hostingX;
            }
            app.stage.removeChild(card.hostedCards[j].renderer.sprite);
            card.hostedCards[j].renderer.destinationPosition.x = xOffset;
            card.hostedCards[j].renderer.destinationPosition.y = yOffset;
            app.stage.addChild(card.hostedCards[j].renderer.sprite);
          }
        }
        xOffset += this.xStep;
        yOffset += this.yStep;
      }
      return { x: xOffset, y: yOffset };
    }
  },

  Counter: class {
    constructor(
      app,
      texture,
      style,
      address,
      key,
      scale,
      hideWhenZero,
      clickCallback
    ) {
      this.app = app;
      this.texture = texture;
      this.address = address;
      this.storedValue = 0; //known value, even if not up to date in visual display yet due to animation time
      this.incrementers = []; //for animation
      this.animateCountdown = 0.0;
      this.key = key;
      this.hideWhenZero = hideWhenZero;
      this.prefix = "";
	  this.postfix = "";
      this.sprite = new PIXI.Sprite(this.texture);
      this.sprite.renderer = this;
      this.app.stage.addChild(this.sprite); //add sprite to the stage container (so it renders)
      //include a particle container for effects
      this.particleContainer = cardRenderer.CreateParticleContainer();
      this.sprite.addChild(this.particleContainer);
      this.particleContainer.scale.x = this.particleContainer.scale.y =
        1.0 / scale; //undo sprite scaling for particles

      // move the counter to the given position
      this.sprite.anchor.set(0.5, 0.5);

      this.richText = new PIXI.Text(this.address[this.key], style);
      this.richText.anchor.set(0.5, 0.5);
      this.app.stage.addChild(this.richText);

      //set scale
      this.sprite.scale.x =
        this.richText.scale.x =
        this.sprite.scale.y =
        this.richText.scale.y =
          scale;

      //apply click callback if provided
      if (typeof clickCallback !== "undefined") {
        this.sprite.interactive = true;
        this.sprite.on("pointerup", clickCallback);
        this.sprite.pointerover = function (mouseData) {
          this.hover = true;
        };
        this.sprite.pointerout = function (mouseData) {
          this.hover = false;
        };
        //some extras to support touch
        this.sprite.on("pointerdown", this.sprite.pointerover);
        this.sprite.on("pointerupoutside", this.sprite.pointerout);
      }

      //add a glow (even if not used right away - might be used later)
      this.glowSprite = new PIXI.Sprite(cardRenderer.counterGlow);
      this.app.stage.addChild(this.glowSprite); //add sprite to the stage container (so it renders)
      //set scale and anchor
      this.glowSprite.scale.x = this.glowSprite.scale.y = 0.5;
      this.glowSprite.anchor.set(0.5, 0.5);
      this.glowSprite.visible = false;

      //ticker to animate counter up/down and (if relevant) glow
      app.ticker.add(function (delta) {
        if (typeof this.glowSprite !== "undefined") {
          //offset to account for the drop shadow
          if (viewingPlayer == runner) {
            this.glowSprite.x = this.sprite.x + 1;
            this.glowSprite.y = this.sprite.y + 1;
          } else {
            this.glowSprite.x = this.sprite.x - 2;
            this.glowSprite.y = this.sprite.y - 1;
          }
          var availability = GetAvailability(this);
          if (availability > 0) {
            this.glowSprite.visible = true;
            if (this.sprite.hover)
              this.glowSprite.tint = parseInt("D800FF", 16);
            //purple
            else this.glowSprite.tint = parseInt("FFFFFF", 16); //white
          } else if (availability == -2) {
            //not interactive, just to highlight something
            this.glowSprite.visible = true;
            this.glowSprite.tint = parseInt("FF0000", 16); //red
          } else this.glowSprite.visible = false;
        }
        //animate changes
        if (this.animateCountdown <= 0.0) {
          if (this.incrementers.length > 0) {
            var oldValue = 1 * this.richText.text;
            var newValue = this.incrementers.shift();
            if (newValue > oldValue)
              cardRenderer.ParticleEffect(
                this.particleContainer,
                particleSystems.addcredit
              );
            else if (newValue < oldValue)
              cardRenderer.ParticleEffect(
                this.particleContainer,
                particleSystems.removecredit
              );
            this.richText.text = this.prefix + newValue + this.postfix;
            this.animateCountdown = 6; //time before next animate (dunno what units this is in? maybe ms but seems a bit slow if so?)
          }
        } else this.animateCountdown -= delta;
      }, this);
    }

    Update() {
      if (this.hideWhenZero && !this.address[this.key]) {
        this.sprite.visible = false;
        this.richText.visible = false;
      } else {
        this.sprite.visible = true;
        this.richText.visible = true;
        var targetValue = this.address[this.key];
        //add incrementers to animate increase/decrease
        while (this.storedValue < targetValue) {
          this.storedValue++;
          this.incrementers.push(this.storedValue);
        }
        while (this.storedValue > targetValue) {
          this.storedValue--;
          this.incrementers.push(this.storedValue);
        }
      }
    }

    SetPosition(x, y) {
      this.sprite.x = x;
      this.sprite.y = y;
      this.richText.x = x;
      this.richText.y = y;
    }
  },

  Card: class {
    //assumes back and glow textures were already loaded e.g. through PIXI.loaders.Loader
    constructor(
      app,
      card,
      front,
      back,
      glow,
      strengthInfo = { texture: null, num: 0, ice: false, cost: null },
      textStyle
    ) {
      this.app = app;
      this.card = card; //the actual game card
      this.frontTexture = front;
      cardRenderer.loadingTextures.push(this.frontTexture);
      this.backTexture = back.back;
      this.glowTextures = glow;
      this.faceUp = false; //flipProgress will tend towards the result required by this
      this.flipProgress = -1.0; //-1 = fully face down, 0 = neither, 1 = fully face up
      this.zoomed = false;
      this.canView = false;
      this.storedRotation = 0;
      this.storedPosition = { x: 0, y: 0 };
      this.destinationPosition = { x: 0, y: 0 };
      this.destinationRotation = 0;
      this.temporaryStorage = {}; //use this to keep temporary data

      this.defaultMaskDimensions = { x: -140, y: -203, w: 280, h: 243, r: 15 };
      this.iceMaskDimensions = { x: -137, y: -203, w: 137, h: 400, r: 15 };
      var dMD = this.defaultMaskDimensions;

      //sprite (main image)
      this.sprite = new PIXI.Sprite(this.backTexture);
      this.sprite.card = this;
      this.app.stage.addChild(this.sprite); //add sprite to the stage container (so it renders)
      this.sprite.scale.x = this.sprite.scale.y = 0.5;
      this.sprite.anchor.set(0.5, 0.5);
      this.sprite.interactive = true; //for hover and click
      this.sprite.buttonMode = false; //this button mode will mean the hand cursor appears
      this.defaultMask = new PIXI.Graphics()
        .beginFill(0xffffff)
        .drawRoundedRect(dMD.x, dMD.y, dMD.w, dMD.h, dMD.r)
        .endFill();
      this.defaultMask.visible = false;
      this.sprite.addChild(this.defaultMask);
	  
      //dummy for mouse checks when zoomed (added to/removed from stage as needed)
      this.dummy = new PIXI.Sprite(this.frontTexture);
      this.dummy.card = this;
      this.dummy.interactive = true; //but will only be visible on the stage when zoomed
      this.dummy.scale.x = this.dummy.scale.y = 0.5;
      this.dummy.anchor.set(0.5, 0.5);
      this.dummy.alpha = 0.001;
      this.dummyDefaultMask = new PIXI.Graphics()
        .beginFill(0xffffff)
        .drawRoundedRect(dMD.x, dMD.y, dMD.w, dMD.h, dMD.r)
        .endFill();
      this.dummyDefaultMask.visible = false;
      this.dummy.addChild(this.dummyDefaultMask);

      //hit area doesn't automatically change with mask, we need to do it manually
      var bounds = this.sprite.getLocalBounds(); //uncropped shape
      this.unmaskedDimensions = {
        x: bounds.x,
        y: bounds.y,
        w: bounds.width,
        h: bounds.height,
        r: 5,
      };
      var uMD = this.unmaskedDimensions;
      this.sprite.hitArea = new PIXI.RoundedRectangle(
        uMD.x,
        uMD.y,
        uMD.w,
        uMD.h,
        uMD.r
      );

      //icon to show if known even though facedown:
      this.knownSprite = new PIXI.Sprite(back.known);
      this.sprite.addChild(this.knownSprite);
      this.knownSprite.scale.x = this.knownSprite.scale.y = 2.0;
      //this.knownSprite.anchor.set(-1.3,2);
      this.knownSprite.anchor.set(-0.35, 1.2);

      //icon and text for strength, if relevant:
      this.strengthSprite = null;
      this.strengthText = null;
      if (strengthInfo.texture != null) {
        this.strengthSprite = new PIXI.Sprite(strengthInfo.texture);
        this.strengthText = new PIXI.Text(strengthInfo.num, textStyle);
        this.strengthText.text = strengthInfo.num;
        this.sprite.addChild(this.strengthSprite);
        this.strengthSprite.addChild(this.strengthText);
        this.strengthSprite.anchor.set(0.5, 0.5);
        this.strengthText.anchor.set(0.5, 0.5);
        if (strengthInfo.ice) {
          //i.e. card is ice (not icebreaker)
          var iMD = this.iceMaskDimensions;

          this.iceMask = new PIXI.Graphics()
            .beginFill(0xffffff)
            .drawRoundedRect(iMD.x, iMD.y, iMD.w, iMD.h, iMD.r)
            .endFill();
          this.iceMask.visible = false;
          this.sprite.addChild(this.iceMask);

          this.dummyIceMask = new PIXI.Graphics()
            .beginFill(0xffffff)
            .drawRoundedRect(iMD.x, iMD.y, iMD.w, iMD.h, iMD.r)
            .endFill();
          this.dummyIceMask.visible = false;
          this.dummy.addChild(this.dummyIceMask);

          this.strengthSprite.rotation = 270 * (Math.PI / 180);
          //set up subroutine broken visualisations
          this.brokenSprites = [];
          for (var i = 0; i < this.card.subroutines.length; i++) {
            var brokenSprite = new PIXI.Sprite(strengthInfo.brokenTexture);
            this.sprite.addChild(brokenSprite);
            brokenSprite.anchor.set(0.5, 0.5);
            brokenSprite.x = 10; //centre in correct area of card
            this.brokenSprites.push(brokenSprite);
            if (typeof this.card.subroutines[i].visual !== "undefined") {
              brokenSprite.y = -209 + this.card.subroutines[i].visual.y; //-209 is half card height
              brokenSprite.scale.y = this.card.subroutines[i].visual.h / 149.0; //149.0 is the height of broken.png
            }
            brokenSprite.visible = false;
          }
        }
        this.particleContainer = cardRenderer.CreateParticleContainer();
        this.strengthSprite.addChild(this.particleContainer);
        this.particleContainer.scale.x = this.particleContainer.scale.y = 2.0; //undo sprite scaling for particles
        this.storedStrength = strengthInfo.num; //known value, even if not up to date in visual display yet due to animation time
        this.targetStrength = strengthInfo.num; //actual value, ahead of animation
        this.strengthIncrementers = []; //for animation
        this.strengthAnimateCountdown = 0.0;
        app.ticker.add(function (delta) {
          this.targetStrength = Strength(this.card);
          //add incrementers to animate increase/decrease
          while (this.storedStrength < this.targetStrength) {
            this.storedStrength++;
            this.strengthIncrementers.push(this.storedStrength);
          }
          while (this.storedStrength > this.targetStrength) {
            this.storedStrength--;
            this.strengthIncrementers.push(this.storedStrength);
          }
          //animate the incrementers
          if (this.strengthAnimateCountdown <= 0.0) {
            if (this.strengthIncrementers.length > 0) {
              var oldValue = 1 * this.strengthText.text;
              var newValue = this.strengthIncrementers.shift();
              if (newValue > oldValue)
                cardRenderer.ParticleEffect(
                  this.particleContainer,
                  particleSystems.strengthup
                );
              else if (newValue < oldValue)
                cardRenderer.ParticleEffect(
                  this.particleContainer,
                  particleSystems.strengthdown
                );
              this.strengthText.text = newValue;
              this.strengthAnimateCountdown = 6; //time before next animate (dunno what units this is in? maybe ms but seems a bit slow if so?)
            }
          } else this.strengthAnimateCountdown -= delta;
        }, this);
      }
      //icon and text for cost, if relevant
      this.costSprite = null;
      this.costText = null;
      if (strengthInfo.cost != null) {
        this.printedCost = 0;
        if (typeof this.card.rezCost !== "undefined")
          this.printedCost = this.card.rezCost;
        else if (typeof this.card.playCost !== "undefined")
          this.printedCost = this.card.playCost;
        else if (typeof this.card.installCost !== "undefined")
          this.printedCost = this.card.installCost;

        this.costSprite = new PIXI.Sprite(strengthInfo.cost);
        this.costText = new PIXI.Text(strengthInfo.num, textStyle);
        this.costText.text = this.printedCost;
        this.sprite.addChild(this.costSprite);
        this.costSprite.addChild(this.costText);
        this.costSprite.anchor.set(0.5, 0.5);
        this.costText.anchor.set(0.5, 0.5);
        this.costParticleContainer = cardRenderer.CreateParticleContainer();
        this.costSprite.addChild(this.costParticleContainer);
        this.costParticleContainer.scale.x =
          this.costParticleContainer.scale.y = 2.0; //undo sprite scaling for particles
        this.storedCost = this.printedCost; //known value, even if not up to date in visual display yet due to animation time
        this.targetCost = this.printedCost; //actual value, ahead of animation
        this.costIncrementers = []; //for animation
        this.costAnimateCountdown = 0.0;
        app.ticker.add(function (delta) {
          this.targetCost = this.printedCost;
          if (typeof this.card.rezCost !== "undefined")
            this.targetCost = RezCost(this.card);
          //else if (typeof(this.card.playCost) !== 'undefined') this.targetCost = PlayCost(this.card); //nothing modifies this at the moment
          else if (typeof this.card.installCost !== "undefined")
            this.targetCost = InstallCost(this.card);
          //add incrementers to animate increase/decrease
          while (this.storedCost < this.targetCost) {
            this.storedCost++;
            this.costIncrementers.push(this.storedCost);
          }
          while (this.storedCost > this.targetCost) {
            this.storedCost--;
            this.costIncrementers.push(this.storedCost);
          }
          //animate the incrementers
          if (this.costAnimateCountdown <= 0.0) {
            if (this.costIncrementers.length > 0) {
              var oldValue = 1 * this.costText.text;
              var newValue = this.costIncrementers.shift();
              if (newValue > oldValue)
                cardRenderer.ParticleEffect(
                  this.costParticleContainer,
                  particleSystems.costup
                );
              else if (newValue < oldValue)
                cardRenderer.ParticleEffect(
                  this.costParticleContainer,
                  particleSystems.costdown
                );
              this.costText.text = newValue;
              this.costAnimateCountdown = 6; //time before next animate (dunno what units this is in? maybe ms but seems a bit slow if so?)
            }
          } else this.costAnimateCountdown -= delta;
        }, this);
      }
      this.glowSprite = new PIXI.Sprite(this.glowTextures.zoomed);
      this.sprite.glow = this.glowSprite; //for reference in interactive callbacks
      this.app.stage.addChild(this.glowSprite); //add sprite to the stage container (so it renders)
      this.glowSprite.scale.x = this.glowSprite.scale.y = 0.5;
      this.glowSprite.anchor.set(0.5, 0.5);
      this.glowSprite.visible = false;

      this.hover = false;
      this.availability = 0;
      this.UpdateGlow = function () {
        this.glowSprite.visible = false;
        this.glowSprite.scale = this.sprite.scale;
        this.availability = GetAvailability(this);
        if (this.availability == -3) {
          //accessing
          this.glowSprite.visible = true;
          this.glowSprite.tint = parseInt("0000FF", 16); //blue
        } else if (this.availability > 0) {
          this.glowSprite.visible = true;
          if (this.availability == 3) {
            //special case - toggled as selection
            //if (this.hover) this.glowSprite.tint = parseInt("FFFFFF",16); //white
            this.glowSprite.tint = parseInt("D800FF", 16); //purple
          } else if (this.hover) {
            if (!this.sprite.dragging) {
              if (this.availability == 2)
                this.glowSprite.tint = parseInt("FFD800", 16);
              //yellow (to indicate it won't immediately activate)
              else this.glowSprite.tint = parseInt("D800FF", 16); //purple
            } else if (pixi_playThreshold(this)) {
              //there swere some special red cases but they are now all purple for consistency (purple means "this will happen when you release")
              //if (executingCommand=="trash") this.glowSprite.tint = parseInt("FF0000",16); //special case: dragging to trash (e.g. before install), red
              //else if (executingCommand=="discard") this.glowSprite.tint = parseInt("FF0000",16); //special case: dragging to discard, red
              //else
              this.glowSprite.tint = parseInt("D800FF", 16); //purple
            } else this.glowSprite.visible = false; //don't glow while dragging if nothing will happen
          } else {
            //if a card is being dragged from hand, don't glow unless some important reason to
            var hand = PlayerHand(activePlayer);
            if (pixi_draggingData !== null) this.glowSprite.visible = false;
            else this.glowSprite.tint = parseInt("FFFFFF", 16); //white
          }
        } else {
          if (pixi_draggingData !== null || OptionsAreOnlyUniqueServers()) {
            //i.e. something is being dragged or a server selection is being made
            var server = null;
            this.glowSprite.visible = false;
            if (this.card == corp.identityCard) server = corp.HQ;
            if (corp.RnD.cards.length > 0) {
              if (this.card == corp.RnD.cards[0]) server = corp.RnD;
            }
            if (corp.archives.cards.length > 0) {
              if (this.card == corp.archives.cards[0]) server = corp.archives;
            }
            if (server == null) server = GetServer(this.card);
            var validServer = false;
            if (server !== null) {
              validServer = ServerIsValidOption(server);
              if (currentPhase.targetServerCardsOnly) {
                if (typeof server.cards !== "undefined") {
                  if (!server.cards.includes(this.card)) validServer = false;
                } else validServer = false; //only targeting .cards therefore ignore remotes
              }
            }
            if (validServer) {
              this.glowSprite.visible = true;
              this.glowSprite.tint = parseInt("FFFFFF", 16); //white
              if (MouseIsOverServer(server)) {
                if (pixi_playThreshold(pixi_draggingCard))
                  this.glowSprite.tint = parseInt("D800FF", 16); //purple
              }
            } //not a server? maybe a potential host
            else {
              if (CardIsValidHostOption(this.card)) {
                this.glowSprite.visible = true;
                this.glowSprite.tint = parseInt("FFFFFF", 16); //white
                //if play threshold is met, this may be the chosen host
                if (
                  pixi_playThreshold(pixi_draggingCard) &&
                  this.isClosestHost
                ) {
                  this.glowSprite.tint = parseInt("D800FF", 16); //purple
                }
              }
            }
          }
        }
      };
      // events for drag and drop
      this.sprite
        .on("pointerdown", pixi_onDragStart)
        .on("pointerup", pixi_onDragEnd)
        .on("pointerupoutside", pixi_onDragEnd)
        .on("pointermove", pixi_onDragMove);
      this.sprite.pointerover = function (event) {
        //prevent a glitch at first hover
        if (
          this.card.storedPosition.x == 0 &&
          this.card.storedPosition.y == 0
        ) {
          this.card.storedPosition.x = this.x;
          this.card.storedPosition.y = this.y;
        }
        if (pixi_draggingCard && pixi_draggingCard != this.card) return; //if card trails behind mouse by a frame, prevent weirdness
        if (!this.card.zoomed) {
          if (event.data.pointerType !== "touch") {
            //touch (left-click is "mouse")
            this.card.ToggleZoom();
          }
        }
        this.card.hover = true;
        this.card.UpdateGlow();
        this.buttonMode = this.card.availability > 0;
      };
      this.sprite.pointerout = function (event) {
        if (pixi_draggingCard == this.card) return; //if card trails behind mouse by a frame, prevent weirdness
        if (this.card.zoomed) {
          this.card.ToggleZoom();
          //restore its position and rotation (it may have been moved for zoom by touch code)
          this.card.sprite.x = this.card.storedPosition.x;
          this.card.sprite.y = this.card.storedPosition.y;
          this.card.sprite.rotation = this.card.storedRotation;
        }
        this.card.hover = false;
        this.card.UpdateGlow();
      };
      //some extras to support touch
      this.sprite.on("pointerdown", this.sprite.pointerover);
      this.sprite.on("pointerupoutside", this.sprite.pointerout);

      //this.sprite.on('pointerdown', this.OnClick);
      this.sprite.on("pointerup", function (event) {
        //note this is all in the context of sprite
        if (event.data.pointerType == "touch") {
          //touch (left-click is "mouse")
          //for touch, 'pointerup' moves cursor off card
          if (pixi_holdTimeout == 0) {
            this.pointerout(event);
            return;
          }
        }
        this.card.OnClick.call(this, event);
      });

      this.SetTextureToFront = function () {
        this.sprite.texture = this.frontTexture;
      };
      this.SetTextureToBack = function () {
        this.sprite.texture = this.backTexture;
      };

      //add a ticker for this card
      this.minZoomLoops = 1;
      app.ticker.add(function (delta) {
        var showFace =
          (this.card === accessingCard && viewingPlayer == runner) ||
          this.faceUp ||
          (this.canView && this.zoomed);
        //use correct mask
        var maskOffset = { x: 0, y: 86 }; //by default, view begins from top left of card
        this.sprite.anchor.set(0.5, 0.293);
        var maskToUse = this.defaultMask;
        var dummyMaskToUse = this.dummyDefaultMask;
        var hitDimensionsToUse = this.defaultMaskDimensions;
        var isEncounter = false;
        this.sprite.interactive = true;
        if (GetApproachEncounterIce() == this.card) {
          if (CheckEncounter()) isEncounter = true;
          //no interaction if choosing subroutines
          if (OptionsAreOnlyUniqueSubroutines())
            this.sprite.interactive = false;
        }
        //apply visual rules for when card is cropped
        var forceCropped =
          this.availability < 1 &&
          this == pixi_holdCard &&
          !pixi_holdZoom &&
          !(
            OptionsAreOnlyUniqueSubroutines() &&
            this.card === GetApproachEncounterIce()
          );
        var useCropped =
          (forceCropped || !this.zoomed) &&
          !isEncounter &&
          pixi_draggingCard !== this &&
		  !PlayerHand(viewingPlayer).includes(this.card);
        if (useCropped) {
          if (this.costSprite != null) {
            if (showFace && 1 * this.costText.text != this.printedCost) {
              this.costSprite.visible = true;
              if (this.card.player == runner) {
                this.costSprite.x = -109;
                this.costSprite.y = -87;
              } else {
                if (CheckInstalled(this.card)) {
                  this.costSprite.x = -45;
                  this.costSprite.y = -178;
                } else {
                  this.costSprite.x = -119;
                  this.costSprite.y = -94;
                }
              }
            } else this.costSprite.visible = false;
          }
          if (this.strengthSprite != null) {
            //icebreaker
            this.strengthSprite.x = -108;
            this.strengthSprite.y = 78;
            this.strengthText.x = -7;
            this.strengthText.y = 0;
            if (viewingPlayer == runner) this.strengthText.rotation = 0;
            else this.strengthText.rotation = Math.PI;
          }
          this.glowSprite.texture = this.glowTextures.unzoomed;
          if (!showFace) {
            maskOffset = { x: 0, y: 86 }; //view centre of card
            this.sprite.anchor.set(0.5, 0.5);
          }
          if (typeof this.iceMask !== "undefined") {
            this.defaultMask.visible = false;
            this.dummyDefaultMask.visible = false;
            this.strengthSprite.x = -47;
            this.strengthSprite.y = 169;
            this.strengthText.x = -2;
            this.strengthText.y = 4;
            if (viewingPlayer == runner) this.strengthText.rotation = 0;
            else this.strengthText.rotation = Math.PI;
            if (CheckInstalled(this.card)) {
              maskToUse = this.iceMask;
              dummyMaskToUse = this.dummyIceMask;
              hitDimensionsToUse = this.iceMaskDimensions;
              this.glowSprite.texture = this.glowTextures.ice;
              if (!showFace) {
                maskOffset = { x: 70, y: 0 }; //view centre of card rotated
                this.sprite.anchor.set(0.5, 0.5);
              } else {
                maskOffset = { x: 70, y: 0 };
                this.sprite.anchor.set(0.25, 0.5);
              }
            } else {
              this.iceMask.visible = false;
              this.dummyIceMask.visible = false;
            }
          }

          this.sprite.mask = maskToUse;
          maskToUse.visible = true;
          maskToUse.x = maskOffset.x;
          maskToUse.y = maskOffset.y;

          this.dummy.mask = dummyMaskToUse;
          dummyMaskToUse.visible = true;
          dummyMaskToUse.x = maskOffset.x;
          dummyMaskToUse.y = maskOffset.y;

          var hAD = hitDimensionsToUse;
          this.sprite.hitArea = new PIXI.RoundedRectangle(
            hAD.x + maskOffset.x,
            hAD.y + maskOffset.y,
            hAD.w,
            hAD.h,
            hAD.r
          );
        } //zoomed or being approached/encountered
        else {
          //correct sprite positioning
          if (this.costSprite != null) {
            if (showFace && 1 * this.costText.text != this.printedCost) {
              this.costSprite.visible = true;
              if (this.card.player == runner) {
                this.costSprite.x = -109;
                this.costSprite.y = -174;
              } else {
                this.costSprite.x = -119;
                this.costSprite.y = -184;
              }
            } else this.costSprite.visible = false;
          }
          if (this.strengthSprite != null) {
            //ice or icebreaker
            if (typeof this.iceMask !== "undefined") {
              this.iceMask.visible = false;
              this.dummyIceMask.visible = false;
              if (GetApproachEncounterIce() == this.card) {
                //being approached/encountered (or moving on from)
                this.strengthSprite.x = -129;
                this.strengthSprite.y = 182;
                this.strengthText.x = -4;
                this.strengthText.y = 2;
                if (viewingPlayer == runner) this.strengthText.rotation = 0;
                else this.strengthText.rotation = Math.PI;
              } //zoomed
              else {
                this.strengthSprite.x = -129;
                this.strengthSprite.y = 182;
                this.strengthText.x = -4;
                this.strengthText.y = 0;
                this.strengthText.rotation = 0.5 * Math.PI;
              }
            } //icebreaker
            else {
              this.strengthSprite.x = -118;
              this.strengthSprite.y = 187;
              this.strengthText.x = -4;
              this.strengthText.y = 0;
              this.strengthText.rotation = 0;
            }
          }
          //update mask
          this.sprite.mask = null;
          this.dummy.mask = null;
          this.defaultMask.visible = false;
          this.dummyDefaultMask.visible = false;
          var hAD = this.unmaskedDimensions;
          this.sprite.hitArea = new PIXI.RoundedRectangle(
            hAD.x,
            hAD.y,
            hAD.w,
            hAD.h,
            hAD.r
          );

          this.sprite.anchor.set(0.5, 0.5);
          this.glowSprite.texture = this.glowTextures.zoomed;
        }
        //show visible effect for broken subroutines when relevant
        if (typeof this.brokenSprites !== "undefined") {
          for (var i = 0; i < this.brokenSprites.length; i++) {
            this.brokenSprites[i].visible = this.card.subroutines[i].broken;
            this.brokenSprites[i].x = maskOffset.x + 8;
          }
        }
        //check to see if hover is trying to move off the card
        if (this.hover && this.zoomed && !this.sprite.dragging) {
          //annoyingly we need an extra loop of time here to give dummy time to catch up
          if (this.minZoomLoops < 1) {
            //do this by letting mouse through the sprite (to check with the dummy instead)
            this.sprite.interactive = false;
            //the previous implementation of mouse position didn't support touch
            //var mousePosition = this.app.renderer.plugins.interaction.mouse.global;
            var mousePosition = this.app.stage.toGlobal(
              cardRenderer.MousePosition()
            );
            var isHit =
              this.app.renderer.plugins.interaction.hitTest(mousePosition);
            this.sprite.interactive = true;
            if (isHit) {
              if (isHit.card !== this) this.sprite.pointerout();
            } else this.sprite.pointerout();
          } else this.minZoomLoops--;
        } else {
          this.minZoomLoops = 1;
        }

        //now update/animate position, rotation, etc.
        var dispDiff = {};
        var destRot = this.destinationRotation;
        var scaleDiff = 0;
        if (
          ((this.zoomed === true && !forceCropped) ||
            this.sprite.dragging === true) &&
          (this.card.faceUp || this.canView)
        ) {
          destRot = 0;
          if (viewingPlayer == corp) {
            if (this.sprite.dragging === true && this.card.cardType == "ice")
              destRot = Math.PI * 0.5;
            else destRot = Math.PI;
          }
        }
		if (this.forceIceRotation) destRot = Math.PI * 0.5;
        if (this.zoomed === true) {
          dispDiff.x = this.destinationPosition.x - this.storedPosition.x;
          dispDiff.y = this.destinationPosition.y - this.storedPosition.y;
        } else {
          dispDiff.x = this.destinationPosition.x - this.sprite.x;
          dispDiff.y = this.destinationPosition.y - this.sprite.y;
        }
        dispDiff.r = destRot - this.sprite.rotation;
        var sqDist = dispDiff.x * dispDiff.x + dispDiff.y * dispDiff.y;
        var deltaVec = {};
        if (sqDist < 1) {
          deltaVec.x = 0;
          deltaVec.y = 0;
        } else {
          dispDiff.invLength = 1 / Math.sqrt(sqDist);
          var speed = 30;
          var spdMult = delta * speed * dispDiff.invLength;
          if (spdMult > 1) spdMult = 1;
          deltaVec.x = dispDiff.x * spdMult;
          deltaVec.y = dispDiff.y * spdMult;
        }
        if (dispDiff.r > Math.PI) dispDiff.r -= 2.0 * Math.PI;
        else if (dispDiff.r < -Math.PI) dispDiff.r += 2.0 * Math.PI;
        var rspeed = 0.1;
        if (this.card.player != viewingPlayer) {
          if (this.card == accessingCard) rspeed = 100;
          //fixes a spinny glitch
          else rspeed = 0.5;
        }
        if (Math.abs(dispDiff.r) < rspeed * delta) {
          deltaVec.r = dispDiff.r;
        } else {
          if (dispDiff.r < 0) deltaVec.r = -rspeed * delta;
          else if (dispDiff.r > 0) deltaVec.r = rspeed * delta;
        }

        if (this.zoomed === true || this.sprite.dragging === true) {
          this.storedPosition.x += deltaVec.x;
          this.storedPosition.y += deltaVec.y;
        } else {
          this.sprite.x += deltaVec.x;
          this.sprite.y += deltaVec.y;
        }
        this.sprite.rotation += deltaVec.r;
        this.glowSprite.rotation = this.sprite.rotation;
        this.UpdateGlow(); //TODO optimise by doing this less often?

        var flipSpeed = 0.1;
        if (showFace && this.flipProgress < 1.0) {
          //flipping face up
          this.flipProgress += flipSpeed * delta;
          if (this.flipProgress > 0.0) this.SetTextureToFront();
        } else if (!showFace && this.flipProgress > -1.0) {
          //flipping face down
          this.flipProgress -= flipSpeed * delta;
          if (this.flipProgress < 0.0) this.SetTextureToBack();
        } //in desired state already
        else {
          if (showFace) {
            this.flipProgress = 1.0;
            this.SetTextureToFront();
          } else {
            this.flipProgress = -1.0;
            this.SetTextureToBack();
          }
        }
        //show 'known' icon if relevant
        //for your own cards, show the ones the opponent can look at (except when face up in which case it's unnecessary)
        //for opponent's cards, show the ones you can look at (except when face up in which case it's unnecessary)
        var showKnownSprite = false;
        if (!IsFaceUp(this.card)) {
          var otherPlayer = corp;
          if (this.card.player == corp) otherPlayer = runner;
          if (this.card.player == viewingPlayer) {
            if (!this.zoomed)
              showKnownSprite = PlayerCanLook(otherPlayer, this.card);
            else showKnownSprite = false;
          } else if (this.canView && this.flipProgress < 0.0) {
            // only need to show icon if we can't see the front
            showKnownSprite = true;
          }
        }
        this.knownSprite.visible = showKnownSprite;
        //change scale as required
        var scalingratio = 0.5;
        if (this.zoomed && (this.faceUp || this.canView))
          scalingratio = fieldZoom;
        if (
          this == pixi_holdCard &&
          !pixi_holdZoom &&
          !(
            OptionsAreOnlyUniqueSubroutines() &&
            this.card === GetApproachEncounterIce()
          )
        ) {
          scalingratio = 0.5; //this is different to forceCropped since it also unzooms dragging cards
          //special rules for facedown cards
          if (!this.faceUp) {
            this.flipProgress = -1.0;
            this.SetTextureToBack();
          }
		  //special rules for installed ice (to keep it sideways unless zoomed)
          if (this.card.cardType == "ice") {
            if (CheckInstalled(this.card)) {
              this.sprite.rotation = 0.5 * Math.PI;
            }
          }
        }
        //make sure card isn't bigger than screen (assumes image dimensions 300x419)
        if ((scalingratio * 300) / fieldZoom > window.innerWidth)
          scalingratio = (fieldZoom * window.innerWidth) / 300;
        if ((scalingratio * 419) / fieldZoom > window.innerHeight)
          scalingratio = (fieldZoom * window.innerHeight) / 419;
        //animate the scale
        var scaleDiff = scalingratio - this.sprite.scale.y;
        var scalingSpeed = -0.5 * scaleDiff + 1; //creates a custom scale animation curve. Realistically this assumes -1 < x < 1
        this.sprite.scale.y += scalingSpeed * delta;
        //now clamp
        if (scalingSpeed > 0) {
          if (this.sprite.scale.y > scalingratio)
            this.sprite.scale.y = scalingratio;
        } else {
          if (this.sprite.scale.y < scalingratio)
            this.sprite.scale.y = scalingratio;
        }
        this.sprite.scale.x = this.sprite.scale.y * Math.abs(this.flipProgress);

        var hideDummy = true;
        if (forceCropped) {
          //keep immovable cards where they are when unzoomed (prevents glitch when near edge of screen due to zoom realignment)
          this.sprite.x = this.destinationPosition.x;
          this.sprite.y = this.destinationPosition.y;
        } else if (this.zoomed) {
          //apply some last positionings
          //on mobile, move the card elsewhere other than your finger
          if (scalingratio > 0.5) {
            //i.e., actually zoomed
            hideDummy = false;
            if (pixi_holdZoom) {
              //i.e., on mobile
              var arbitraryExtraSpace = 100;
              if (this.storedPosition.x < cardRenderer.app.renderer.width * 0.5)
                this.sprite.x =
                  cardRenderer.app.renderer.width -
                  0.5 * this.sprite.width -
                  arbitraryExtraSpace;
              else
                this.sprite.x = 0.5 * this.sprite.width + arbitraryExtraSpace;
              this.sprite.y = 0.5 * cardRenderer.app.renderer.height;
            }
          }
          //prevent card going off the screen (except when can't see front e.g. choosing card for access in Corp hand)
		  if (showFace) {
			  if (this.sprite.x - 0.5 * this.sprite.width < 0)
				this.sprite.x = 0.5 * this.sprite.width;
			  if (
				this.sprite.x + 0.5 * this.sprite.width >
				cardRenderer.app.renderer.width
			  )
				this.sprite.x =
				  cardRenderer.app.renderer.width - 0.5 * this.sprite.width;
			  if (this.sprite.y - 0.5 * this.sprite.height < 0)
				this.sprite.y = 0.5 * this.sprite.height;
			  if (
				this.sprite.y + 0.5 * this.sprite.height >
				cardRenderer.app.renderer.height
			  )
				this.sprite.y =
				  cardRenderer.app.renderer.height - 0.5 * this.sprite.height;
		  }
        }

        //and dummy needs to be positioned correctly
        if (hideDummy) {
          this.dummy.alpha = 0.001;
        } else {
          this.dummy.alpha = 1.0;
        }
        this.dummy.x = this.storedPosition.x;
        this.dummy.y = this.storedPosition.y;
        this.dummy.rotation = this.storedRotation;

        //glow needs to stay with card
        this.glowSprite.x = this.sprite.x;
        this.glowSprite.y = this.sprite.y;
        this.glowSprite.rotation = this.sprite.rotation;
        this.glowSprite.scale = this.sprite.scale;
      }, this);
    }

    //Clone will create a separate card but reuse the texture data
    Clone() {
      return new CardRenderer.Card(
        this.app,
        this.frontTexture,
        this.backTexture,
        this.glowTextures
      );
    }

    //FaceDown will change the sprite to show the card back
    FaceDown() {
      this.faceUp = false;
      if (this.strengthSprite) this.strengthSprite.visible = false;
      if (this.strengthText) this.strengthText.visible = false;
    }

    //FaceUp will change the sprite to show the card front
    FaceUp(text = "") {
      this.faceUp = true;
      if (this.strengthText && this.strengthSprite) {
        if (text === "") {
          this.strengthSprite.visible = false;
          this.strengthText.visible = true;
        } else {
          this.strengthSprite.visible = true;
          this.strengthText.visible = true;
          this.targetStrength = text * 1;
        }
      }
    }

    //SetRotation takes input in degrees
    SetRotation(angle) {
      this.destinationRotation = angle * (Math.PI / 180);
      this.storedRotation = this.destinationRotation;
    }

    ToggleZoom() {
      if (!this.zoomed && pixi_subroutineDelay >= 0) return; //don't zoom new cards during this time

      if (
        this.zoomed === true &&
        OptionsAreOnlyUniqueSubroutines() &&
        this.card === GetApproachEncounterIce()
      ) {
        //stay zoomed
        this.glowSprite.parent.addChild(this.glowSprite);
        this.sprite.parent.addChild(this.sprite); //keep it on top!
      } else if (this.zoomed === true) {
        //unzoom
        this.sprite.parent.setChildIndex(
          this.sprite,
          this.sprite.originalIndex
        );
        this.glowSprite.parent.setChildIndex(
          this.glowSprite,
          this.glowSprite.originalIndex
        );
        this.dummy.parent.removeChild(this.dummy);
        this.zoomed = false;
        //some properties need to immediately change back when zooming out (rather than animating)
        if (this == pixi_holdCard && pixi_holdZoom) {
          //i.e. touch to zoom (we visually moved the card into another place to avoid finger obstructing)
          this.sprite.rotation = this.storedRotation;
          this.sprite.x = this.storedPosition.x;
          this.sprite.y = this.storedPosition.y;
        }
      } else if (
        this.faceUp ||
        this.canView ||
        this.availability == 2 ||
        this == pixi_holdCard
      ) {
        //zoom
        this.storedPosition.x = this.sprite.x;
        this.storedPosition.y = this.sprite.y;
        this.storedRotation = this.sprite.rotation;

        this.sprite.originalIndex = this.sprite.parent.getChildIndex(
          this.sprite
        );
        this.glowSprite.originalIndex = this.glowSprite.parent.getChildIndex(
          this.glowSprite
        );
        this.sprite.parent.addChild(this.dummy); //make sure the dummy is in the stage
        this.dummy.parent.setChildIndex(this.dummy, this.sprite.originalIndex); //put the dummy where the card was
        this.glowSprite.parent.addChild(this.glowSprite);
        this.sprite.parent.addChild(this.sprite); //because the card is going on top!
        this.zoomed = true;
        if (this.canView) this.flipProgress = 1.0;
      }
    }

    //click callback (uses this.sprite as context)
    OnClick() {
      if (this.card.availability == 2) {
        //i.e. drag and drop to choose
        if (pixi_playThreshold(this.card)) {
          if (ResolveClick(this.card)) {
            this.card.storedPosition.x = this.x;
            this.card.storedPosition.y = this.y;
            this.card.destinationPosition.x = this.x;
            this.card.destinationPosition.y = this.y;
            if (this.card.card.player == corp)
              this.card.destinationRotation = Math.PI;
            else this.card.destinationRotation = 0;
          }
        }
        this.pointerout(); //clear highlight
        return;
      } else if (this.card.availability == 1 || this.card.availability == 3) {
        //i.e. click to interact (3 means card is toggled on, click toggles it off)
        this.pointerout(); //clear highlight
        if (ResolveClick(this.card) === true) return;
      }
      //if (this.card.availability != 2) this.card.ToggleZoom(); //click no longer toggles zoom, we're using hover instead

      //click-to-view pile
      if (viewingPile == null) {
        if (
          (this.card.card.cardLocation == corp.archives.cards) ||
          (this.card.card.cardLocation == runner.heap)
        ) {
          viewingPile = this.card.card.cardLocation;
          Render(); //force the visual change
        }
      }
    }

    //in world transform, but relative to anchor
    Extents() {
      //start by saving current and using stored
      var savedRotation = this.sprite.rotation;
      var savedScaleX = this.sprite.scale.x;
      var savedScaleY = this.sprite.scale.y;
      var savedAnchorX = this.sprite.anchor.x;
      var savedAnchorY = this.sprite.anchor.y;
      this.sprite.rotation = this.storedRotation;
      this.sprite.scale.x = 0.5;
      this.sprite.scale.y = 0.5;
      this.sprite.anchor.set(0.5, 0.5);

      //now compute extents
      var oldTexture = null;
      if (!this.sprite.texture.valid) {
        //front texture not loaded, use back
        oldTexture = this.sprite.texture;
        this.sprite.texture = this.backTexture;
      }
      var bounds = this.sprite.getBounds();
      var extents = {};
      extents.l = -(this.sprite.anchor.x * bounds.width);
      extents.r = (1 - this.sprite.anchor.x) * bounds.width;
      extents.t = -(this.sprite.anchor.y * bounds.height);
      extents.b = (1 - this.sprite.anchor.y) * bounds.height;
      if (oldTexture) {
        this.sprite.texture = oldTexture;
      }

      //then restore any animating/modified values
      this.sprite.rotation = savedRotation;
      this.sprite.scale.x = savedScaleX;
      this.sprite.scale.y = savedScaleY;
      this.sprite.anchor.set(savedAnchorX, savedAnchorY);
      return extents;
    }

    //tint according to HSL
    Tint(h, s, l) {
      h /= 360;
      s /= 100;
      l /= 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l; // achromatic
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };
      const hexstr = `${toHex(r)}${toHex(g)}${toHex(b)}`;
      this.sprite.tint = parseInt(hexstr, 16);
    }
  },

  //Create one of these to initialise a renderer
  Renderer: class {
    constructor(resizeCallback) {
      var w = window.innerWidth;
      var h = window.innerHeight;
      this.app = new PIXI.Application(w, h, { transparent: true });
      var container = this.app.stage;
      container.pivot.x = w / 2;
      container.pivot.y = h / 2;
      container.x = w / 2;
      container.y = h / 2;
      document.body.appendChild(this.app.view); //just during creation, in init.js we move it straight away

      this.loadingTextures = [];
      this.loadingMax = 1;

      //set up font styles (https://pixijs.io/pixi-text-style/)
      this.counterStyle = new PIXI.TextStyle({
        fontFamily: "PlayBoldNisei",
        fontSize: 48,
        fontWeight: "bold",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 10,
      });
      this.tutorialStyle = new PIXI.TextStyle({
		fontFamily: "PlayBoldNisei",
        fill: "white",
        fontWeight: "bold",
        miterLimit: 1,
        strokeThickness: 4,
        wordWrap: true,
        wordWrapWidth: 420,
      });
      this.tutorialText = new PIXI.Text("", this.tutorialStyle);
      this.tutorialText.anchor.set(0, 0.5);
      this.app.stage.addChild(this.tutorialText); //add to the stage container (so it renders)

      //store all particle containers created through this
      this.particleContainers = [];

      //load counter highlight texture
      this.counterGlow = PIXI.Texture.fromImage("images/glow_token.png");

      //set up global approachIce indicator
      this.iceGlow = new PIXI.Sprite(
        PIXI.Texture.fromImage("images/ice_white.png")
      );
      this.iceGlow.scale.x = this.iceGlow.scale.y = 0.5;
      this.iceGlow.anchor.set(0.5, 0.5);
      this.iceGlow.visible = false;
      this.app.stage.addChild(this.iceGlow); //add sprite to the stage container (so it renders)
      this.UpdateGlow = function (card, glow, x = null, y = null) {
        //card is a CardRenderer.Card
        this.iceGlow.rotation = 0;
        this.iceGlow.scale.y = 0.5;
        if (card == null && glow == 0) {
          this.iceGlow.visible = false;
        } else if (card == null) {
          //approaching a server
          this.iceGlow.visible = true;
          this.iceGlow.x = x;
          this.iceGlow.y = y;
          this.iceGlow.scale.x = 0.4;
          if (accessList.length > 0) this.iceGlow.tint = parseInt("0000FF", 16);
          //accessing (blue)
          else if (movement) {
            //show at front of server just like if ice was passed
            this.iceGlow.tint = parseInt("0000FF", 16); //movement (blue)
            this.iceGlow.rotation = Math.PI;
            this.iceGlow.scale.x = 0.5;
            this.iceGlow.y += 185; //tweak to feel right
          } else this.iceGlow.tint = parseInt("0000FF", 16); //other (blue) by convention indicates 'in progress, not a choice to click'
        } //approaching ice
        else {
          this.iceGlow.visible = true;
          this.iceGlow.x = card.sprite.x;
          this.iceGlow.y = card.sprite.y;
          this.iceGlow.scale.x = 0.5;
          if (glow == 1) this.iceGlow.tint = parseInt("FF0000", 16);
          //encountering (red)
          else if (glow == 2) this.iceGlow.tint = parseInt("FFFF00", 16);
          //interfacing (yellow)
          else if (glow == 3) {
            this.iceGlow.tint = parseInt("0000FF", 16); //all broken/movement (blue)
            this.iceGlow.rotation = Math.PI;
          } else {
            this.iceGlow.tint = parseInt("0000FF", 16); //approaching (blue) by convention indicates 'in progress, not a choice to click'
            this.iceGlow.y -= 40; //move indicator to match cropped ice
          }
        }
      };

      //and empty&unprotected archives/new remote indicators
      var indicatorsTexture = PIXI.Texture.fromImage(
        "images/glow_outline_dashed_cropped.png"
      );
      this.archivesIndicator = new PIXI.Sprite(indicatorsTexture);
      this.archivesIndicator.scale.x = this.archivesIndicator.scale.y = 0.5;
      this.archivesIndicator.anchor.set(0.5, 0.5);
      this.archivesIndicator.visible = false;
      this.app.stage.addChild(this.archivesIndicator); //add sprite to the stage container (so it renders)
      this.newRemoteIndicator = new PIXI.Sprite(indicatorsTexture);
      this.newRemoteIndicator.scale.x = this.newRemoteIndicator.scale.y = 0.5;
      this.newRemoteIndicator.anchor.set(0.5, 0.5);
      this.newRemoteIndicator.visible = false;
      this.app.stage.addChild(this.newRemoteIndicator); //add sprite to the stage container (so it renders)

      var serverSelectorTexture = PIXI.Texture.fromImage("images/particle.png");
      this.serverSelector = new PIXI.Sprite(serverSelectorTexture);
      this.serverSelector.scale.x = 6; //arbitrary choice to suit width of servers
      this.serverSelector.scale.y = 10; //will be changed realtime to match server heights
      this.serverSelector.anchor.set(0.5, 0.5);
      this.serverSelector.visible = false;
      this.app.stage.addChild(this.serverSelector); //add sprite to the stage container (so it renders)
      this.serverText = new PIXI.Text(0, this.counterStyle);
      this.app.stage.addChild(this.serverText);
      this.serverText.anchor.set(0.5, 0.5);
      this.serverText.scale.x = this.serverText.scale.y = 0.5;

      this.subroutineTexture = PIXI.Texture.fromImage("images/subroutine.png");
      this.subroutineChoices = []; //clickable subroutines - create when needed

      this.showFPS = false;
      this.framerates = []; //to calculate a periodic average
      //key event to toggle fps display
      window.addEventListener(
        "keydown",
        function (event) {
          if (event.key == "f") {
            cardRenderer.showFPS = !cardRenderer.showFPS;
            if (cardRenderer.showFPS) $("#fps").show();
            else $("#fps").hide();
          }
        },
        false
      );

      //add a global ticker
      this.app.ticker.add(function (delta) {
        //make sure all textures are loaded
        if (this.loadingTextures.length > 0) {
          if (this.loadingTextures.length > this.loadingMax)
            this.loadingMax = this.loadingTextures.length;

          for (var i = 0; i < this.loadingTextures.length; i++) {
            if (this.loadingTextures[i].valid) {
              this.loadingTextures.splice(i, 1);
              i--;
              if (
                this.loadingTextures.length == 0 &&
                $("#loading").is(":visible")
              ) {
                $("#loading").hide();
                StartGame();
              }
            }
          }
          var loadingText =
            "Loading " +
            Math.floor(
              (100 * (this.loadingMax - this.loadingTextures.length)) /
                this.loadingMax
            ) +
            "%";
          $("#loading-text").html(loadingText);
        }

        //fps display
        this.framerates.push(PIXI.ticker.shared.FPS);
        if (this.framerates.length == 20) {
          var fpsAverage = 0;
          for (var i = 0; i < this.framerates.length; i++) {
            fpsAverage += this.framerates[i];
          }
          fpsAverage *= 0.05; //average
          this.framerates = []; //reset
          $("#fps").html(Math.round(fpsAverage) + " fps");
        }

        //only show indicators when relevant (hovering and server is a valid option)
        this.archivesIndicator.visible = false;
        if (
          ServerIsValidOption(corp.archives) &&
          corp.archives.cards.length == 0 &&
          corp.archives.root.length == 0 &&
          corp.archives.ice.length == 0
        ) {
          //show indicator only if archives is not empty-and-unprotected
          this.archivesIndicator.visible = true;
          if (MouseIsOverServer(corp.archives)) {
            if (pixi_playThreshold(pixi_draggingCard))
              this.archivesIndicator.tint = parseInt("D800FF", 16);
            //purple
            else this.archivesIndicator.tint = parseInt("FFFFFF", 16); //white
          } else this.archivesIndicator.tint = parseInt("FFFFFF", 16); //white
        }
        if (corp.archives.xStart == corp.archives.xEnd)
          this.archivesIndicator.x =
            0.5 * (corp.archives.xStart + corp.archives.xEnd) - 100;
        //the subtract is arbitrary for aesthetics (spacing from RnD)
        else
          this.archivesIndicator.x =
            0.5 * (corp.archives.xStart + corp.archives.xEnd); //the subtract is arbitrary for aesthetics (spacing from RnD)

        this.newRemoteIndicator.visible = false;
        if (ServerIsValidOption(null)) {
          this.newRemoteIndicator.visible = true;
          if (MouseIsOverServer(null)) {
            if (pixi_playThreshold(pixi_draggingCard))
              this.newRemoteIndicator.tint = parseInt("D800FF", 16);
            //purple
            else this.newRemoteIndicator.tint = parseInt("FFFFFF", 16); //white
          } else this.newRemoteIndicator.tint = parseInt("FFFFFF", 16); //white
        }
        var largestServerX = corp.HQ.xEnd;
        if (corp.remoteServers.length > 0)
          largestServerX =
            corp.remoteServers[corp.remoteServers.length - 1].xEnd;
        this.newRemoteIndicator.x = largestServerX + 150; //arbitrary number

        //show server selector highlight if relevant
        this.serverSelector.visible = false;
        this.serverText.visible = false;
        if (pixi_draggingData !== null || OptionsAreOnlyUniqueServers()) {
          //i.e. something is being dragged or a server selection is being made
          var serverTint = parseInt("FFFFFF", 16); //white
          if (pixi_playThreshold(pixi_draggingCard))
            serverTint = parseInt("D800FF", 16); //purple
          this.serverSelector.tint = serverTint;
          this.serverText.tint = serverTint;
          for (var i = 0; i < validOptions.length; i++) {
            if (
              typeof validOptions[i].card == "undefined" ||
              validOptions[i].card == pixi_draggingCard
            ) {
              if (typeof validOptions[i].server !== "undefined") {
                if (MouseIsOverServer(validOptions[i].server)) {
                  this.serverSelector.visible = true;
                  this.serverText.visible = true;
                  if (validOptions[i].server == null)
                    this.serverSelector.x = this.newRemoteIndicator.x;
                  else
                    this.serverSelector.x =
                      (validOptions[i].server.xStart +
                        validOptions[i].server.xEnd) *
                      0.5;
                  this.serverText.text = ServerName(
                    validOptions[i].server,
                    true,
                    true
                  ); //first true ignores remote numbers, second removes indefinite article
                  this.serverText.x = this.serverSelector.x;
                }
              }
            }
          }
        }

        //special use of iceglow
        if (executingCommand == "trash" || executingCommand == "discard") {
          //trash before install or discard at end of turn
          //NOTE: this currently assuming the player is trashing their own cards
          if (viewingPlayer == runner) {
            this.iceGlow.x = 0.5 * (runner.heap.xStart + runner.heap.xEnd) - 15; //the subtraction amount is arbitrary, tweak to look right
            this.iceGlow.y = runner.heap.yCards - 100; //the subtraction amount is arbitrary, tweak to look right
            this.iceGlow.rotation = Math.PI;
          } //viewingPlayer assumed to be corp
          else {
            this.iceGlow.x = 0.5 * (corp.archives.xStart + corp.archives.xEnd);
            this.iceGlow.y = corp.archives.yCards + 105; //the addition amount is arbitrary, tweak to look right
            this.iceGlow.rotation = 0;
          }

          this.iceGlow.visible = true;
          this.iceGlow.scale.x = 0.35;
          this.iceGlow.scale.y = 0.5;
          if (pixi_draggingCard !== null) {
            if (pixi_playThreshold(pixi_draggingCard))
              this.iceGlow.tint = parseInt("D800FF", 16);
            //purple
            else this.iceGlow.tint = parseInt("FFFFFF", 16); //white
          } else this.iceGlow.visible = false;
        }

        //hide subroutine choices when not longer needed
        // and run a timer to prevent accidentally zooming another card after choosing subroutines
        if (!OptionsAreOnlyUniqueSubroutines()) {
          cardRenderer.RenderSubroutineChoices(null, []);
          if (pixi_subroutineDelay >= 0) {
            pixi_subroutineDelay -= delta;
            //zoom ice out if choosing subroutines is finished
            if (pixi_subroutineDelay < 0) {
              var ice = GetApproachEncounterIce();
              if (ice !== null) {
                if (ice.renderer.zoomed) ice.renderer.ToggleZoom();
              }
            }
          }
        } else {
          pixi_subroutineDelay = 20; //tweak to work well
        }
		
		//update counter rotations each frame (but not text, the true here skips that)
		this.UpdateCounters(true); //doing this every frame might cost us a millisecond or so, that's worth it
      }, this);

      //a special particle trail that travels between breakers and encountered ice
      this.interfacer = new PIXI.ParticleContainer();
      this.interfacer.setProperties({
        scale: true,
        position: true,
        rotation: true,
        uvs: true,
        alpha: true,
      });
      this.interfacer.currentBreakerIdx = -1;
      this.app.stage.addChild(this.interfacer);
      this.interfacer.x = 0;
      this.interfacer.y = 0;
      this.app.ticker.add(function (delta) {
        this.visible = false;
        if (approachIce > -1) {
          if (CheckEncounter()) {
            var encounteredIce = attackedServer.ice[approachIce];

            //loop through all breakers to find ones which can interface
            var installedRunnerCards = InstalledCards(runner);
            var breakers = [];
            for (var i = 0; i < installedRunnerCards.length; i++) {
              if (CheckSubType(installedRunnerCards[i], "Icebreaker")) {
                if (CheckStrength(installedRunnerCards[i])) {
                  if (
                    BreakerMatchesIce(installedRunnerCards[i], encounteredIce)
                  )
                    breakers.push(installedRunnerCards[i]);
                }
              }
            }
            if (breakers.length > 0) {
              this.visible = true;
              //check if reached target or no breaker selected yet
              var iceX = encounteredIce.renderer.sprite.x;
              var iceY = encounteredIce.renderer.sprite.y;
              var newX = this.emitter.spawnPos.x;
              var newY = this.emitter.spawnPos.y;
              var diffX = iceX - newX;
              var diffY = iceY - newY;
              var sqDistToIce = diffX * diffX + diffY * diffY;
              if (
                this.currentBreakerIdx > breakers.length - 1 ||
                this.currentBreakerIdx < 0 ||
                sqDistToIce < 10000
              ) {
                //need new target or else have moved close enough to cycle to next
                this.currentBreakerIdx++;
                if (this.currentBreakerIdx > breakers.length - 1)
                  this.currentBreakerIdx = 0;
                newX = breakers[this.currentBreakerIdx].renderer.sprite.x;
                newY = breakers[this.currentBreakerIdx].renderer.sprite.y;
              } //animate closer
              else {
                var interfacerSpeed = 50.0;
                var deltaSpeedInvDist =
                  (delta * interfacerSpeed) / Math.sqrt(sqDistToIce);
                newX += deltaSpeedInvDist * diffX;
                newY += deltaSpeedInvDist * diffY;
              }
              this.emitter.updateSpawnPos(newX, newY);
            }
          } else this.currentBreakerIdx = -1;
        }
      }, this.interfacer);
      //create the interfacer particle trail
      this.interfacer.emitter = new PIXI.particles.Emitter(
        this.interfacer,
        [PIXI.Texture.fromImage("images/particle.png")],
        particleSystems.interface
      );
      var elapsed = Date.now();
      var interfacerUpdate = function () {
        requestAnimationFrame(interfacerUpdate);
        var now = Date.now();
        if (typeof cardRenderer !== "undefined") {
          cardRenderer.interfacer.emitter.update((now - elapsed) * 0.001);
          elapsed = now;
        }
      };
      this.interfacer.emitter.emit = true;
      interfacerUpdate();

      //set up a callback to resize renderer if window is resized
      window.onresize = function (event) {
        onresize.callback();
      };
      window.onresize.callback = resizeCallback;

      this.counters = [];

      //pile size texts
      this.pileRnDText = new PIXI.Text("", this.counterStyle);
      this.pileRnDText.scale.x = this.pileRnDText.scale.y = 0.3;
      this.app.stage.addChild(this.pileRnDText); //add sprite to the stage container (so it renders)
      this.pileStackText = new PIXI.Text("", this.counterStyle);
      this.pileStackText.scale.x = this.pileStackText.scale.y = 0.3;
      this.app.stage.addChild(this.pileStackText); //add sprite to the stage container (so it renders)

      //global click callbacks
      this.closingView = false;
      this.globalMouseIsDown = false;
      this.app.renderer.plugins.interaction.on("pointerdown", function (event) {
        this.globalMouseIsDown = true;
        pixi_mousePosition = event.data.getLocalPosition(
          cardRenderer.app.stage
        );
        if (viewingPile !== null) this.closingView = true;
      });
      this.app.renderer.plugins.interaction.on("pointerup", function (event) {
        this.globalMouseIsDown = false;
        pixi_mousePosition = event.data.getLocalPosition(
          cardRenderer.app.stage
        );
        //close any viewing pile
        if (this.closingView) {
          this.closingView = false;
          viewingPile = null;
          Render(); //force the visual change
        }

        //click can choose server, if relevant
        if (OptionsAreOnlyUniqueServers()) {
          for (var i = 0; i < validOptions.length; i++) {
            if (MouseIsOverServer(validOptions[i].server))
              ResolveClick(validOptions[i].server);
          }
        }
      });
    }

    //function to get mouse position
    MousePosition() {
      //the first implementation was no good because it didn't support touch
      //return this.app.stage.toLocal(this.app.renderer.plugins.interaction.mouse.global);
      return pixi_mousePosition;
    }

    ChangeSide() {
      this.app.stage.rotation += Math.PI;
    }

    /**
     * Create a card object from the specified front and back textures.
     *
     * @method Renderer.CreateCard
     * @param {PIXI.Texture} front texture for card front
     * @param {PIXI.Texture} back textures for card back
     * @param {PIXI.Texture} glow textures for card glow
     * @returns {CardRenderer.Card} created card object
     */
    CreateCard(card, front, back, glow, strengthInfo) {
      return new CardRenderer.Card(
        this.app,
        card,
        front,
        back,
        glow,
        strengthInfo,
        this.counterStyle
      );
    }

    /**
     * Load an image to create a texture object.
     *
     * @method Renderer.LoadTexture
     * @param {String} str image file
     * @returns {PIXI.Texture} true if card can be played, false otherwise
     */
    LoadTexture(str) {
      var texture = PIXI.Texture.fromImage(str);
      return texture;
    }

    CreateCounter(texture, address, key, scale, hideWhenZero, clickCallback) {
      var ret = new CardRenderer.Counter(
        this.app,
        texture,
        this.counterStyle,
        address,
        key,
        scale,
        hideWhenZero,
        clickCallback
      );
      this.counters.push(ret);
      return ret;
    }

    UpdateCounters(skipUpdate=false) {
      for (var i = 0; i < this.counters.length; i++) {
        var unrotation = this.app.stage.rotation;
        if (this.counters[i].sprite.parent != this.app.stage)
          unrotation += this.counters[i].sprite.parent.rotation;
        this.counters[i].sprite.rotation = -unrotation;
        this.counters[i].richText.rotation = -unrotation;
        if (!skipUpdate) this.counters[i].Update();
        this.counters[i].sprite.parent.addChild(this.counters[i].sprite);
        this.counters[i].richText.parent.addChild(this.counters[i].richText);
      }
    }

    CreateParticleContainer() {
      var ret = new PIXI.ParticleContainer();
      ret.setProperties({
        scale: true,
        position: true,
        rotation: true,
        uvs: true,
        alpha: true,
      });
      this.particleContainers.push(ret);
      return ret;
    }

    HideParticleContainers() {
      for (var i = 0; i < this.particleContainers.length; i++) {
        this.particleContainers[i].visible = false;
      }
    }

    ShowParticleContainers() {
      for (var i = 0; i < this.particleContainers.length; i++) {
        this.particleContainers[i].visible = true;
      }
    }

    ParticleEffect(container, effect) {
      var emitter = new PIXI.particles.Emitter(
        container,
        [PIXI.Texture.fromImage("images/particle.png")],
        effect
      );
      emitter.playOnceAndDestroy();
    }

    RenderSubroutineChoices(card, choices) {
      //first, reset all
      for (var i = 0; i < this.subroutineChoices.length; i++) {
        this.subroutineChoices[i].visible = false;
      }
      //then set choices
      if (card != null) {
        for (var i = 0; i < choices.length; i++) {
          if (typeof choices[i].subroutine !== "undefined") {
            var subroutine = choices[i].subroutine;
            //create new sprite if needed
            if (i > this.subroutineChoices.length - 1) {
              var newSrChoice = new PIXI.Sprite(this.subroutineTexture);
              this.subroutineChoices.push(newSrChoice);
              newSrChoice.anchor.set(0.5, 0.5);
              //apply click callback if provided
              newSrChoice.interactive = true;
              newSrChoice.pointerover = function (mouseData) {
                this.tint = parseInt("D800FF", 16); //purple (by our convention this means 'will immediately activate')
              };
              newSrChoice.pointerout = function (mouseData) {
                this.tint = parseInt("FFFFFF", 16); //white (by our convention this means 'an active choice')
              };
              newSrChoice.on("pointerdown", function () {
                this.tint = parseInt("D800FF", 16); //purple
                //});  //pointerout and pointerupoutside don't seem to be firing properly so this (firing on pointerdown with a delay) is my current solution
                var srchosen = this.subroutine;
                setTimeout(function () {
                  //newSrChoice.on('pointerup', function() {
                  if (ResolveClick(srchosen)) {
                    //hide all
                    for (
                      var j = 0;
                      j < cardRenderer.subroutineChoices.length;
                      j++
                    ) {
                      cardRenderer.subroutineChoices[j].visible = false;
                    }
                    Render();
                  }
                }, 100);
              });
              //extra to support touch
              newSrChoice.on("pointerupoutside", newSrChoice.pointerout);
            }
            this.subroutineChoices[i].subroutine = subroutine;
            card.renderer.sprite.addChild(this.subroutineChoices[i]);
            this.subroutineChoices[i].x = 10; //centre in correct area of card
            if (typeof subroutine.visual !== "undefined") {
              this.subroutineChoices[i].y = -209 + subroutine.visual.y; //-209 is half card height
              this.subroutineChoices[i].scale.y = subroutine.visual.h / 149.0; //149.0 is the height of broken.png
            }
            this.subroutineChoices[i].visible = true;
            this.subroutineChoices[i].tint = parseInt("FFFFFF", 16); //white
          }
        }
      }
    }
  },
};

//some utility variables and functions
var pixi_draggingData = null;
var pixi_draggingCard = null;
var pixi_mouseStart = { x: 0, y: 0 };
var pixi_mousePosition = { x: 0, y: 0 };
var pixi_holdTimeout = 0; //0 = timeout successful, -1 = ignore timeout, > 0 = timeout running
var pixi_holdCard = null; //for touch and hold
var pixi_holdZoom = false; //for touch to distinguish between lift-to-top and zoom
var pixi_subroutineDelay = 0; //to help prevent unwanted card unzoom when selecting subroutines

function pixi_onDragStart(event) {
  pixi_holdCard = this.card;
  pixi_holdZoom = false;
  //note this is all in the context of sprite
  if (event.data.pointerType == "touch") {
    //touch (left-click is "mouse")
    pixi_holdCard.ToggleZoom(); //bring to front
    //start a timeout to detect hold-to-zoom with touch
    pixi_holdTimeout = setTimeout(function () {
      if (pixi_holdCard != null) {
        if (pixi_holdCard.faceUp || pixi_holdCard.canView) {
          pixi_holdZoom = true;
          pixi_holdCard.hover = false;
          pixi_holdCard.UpdateGlow();
        }
      }
      pixi_holdTimeout = 0;
    }, 200);
  }

  pixi_mousePosition = event.data.getLocalPosition(this.parent);
  pixi_mouseStart = pixi_mousePosition;

  if (this.card.availability < 1) return; //1+ means available to click

  //if the card was zoomed, restore its position (it may have been adjusted due to edge of screen)
  pixi_holdCard.sprite.x = pixi_holdCard.storedPosition.x;
  pixi_holdCard.sprite.y = pixi_holdCard.storedPosition.y;

  if (this.card.availability != 2) return; //2 is dragging

  // store a reference to the data (in 'this' i.e. the sprite)
  // the reason for this is because of multitouch
  // we could track the movement of this particular touch
  // (not currently implemented, though)
  this.data = event.data;
  pixi_draggingData = this.data;
  //this.alpha = 0.5;
  this.dragging = true;
  pixi_draggingCard = this.card;
}

function pixi_onDragEnd(event) {
  if (pixi_holdCard !== null) {
    if (pixi_holdCard.zoomed) pixi_holdCard.ToggleZoom();
  }
  pixi_holdCard = null;
  pixi_holdZoom = false;
  //note this is all in the context of sprite
  pixi_mousePosition = event.data.getLocalPosition(this.parent);
  this.alpha = 1;
  this.dragging = false;
  pixi_draggingCard = null;
  // set the interaction data to null
  this.data = null;
  pixi_draggingData = null;
}

function pixi_onDragMove(event) {
  //require a minimum distance
  pixi_mousePosition = event.data.getLocalPosition(this.parent);
  var diff = {
    x: pixi_mousePosition.x - pixi_mouseStart.x,
    y: pixi_mousePosition.y - pixi_mouseStart.y,
  };
  var sqDist = diff.x * diff.x + diff.y * diff.y;
  if (sqDist < 1000) return; //tweak this to work well
  pixi_holdZoom = false;
  //note this is all in the context of sprite
  if (pixi_holdTimeout > 0) {
    clearTimeout(pixi_holdTimeout);
    pixi_holdTimeout = -1;
  } else if (pixi_holdCard != null) {
    pixi_holdTimeout = 1; //I'm not sure why this doesn't lead to a loop between this and the previous condition since this function is called repeatedly...but it's fine for now apparently
    pixi_holdCard.hover = true;
    pixi_holdCard.UpdateGlow();
  }

  if (this.dragging) {
    this.position.x = pixi_mousePosition.x;
    this.position.y = pixi_mousePosition.y;
  }
}

function pixi_SqDistToPile(pile, player) {
  //player is used to determine offset
  //measure pythagorean distance to pile
  var mouse = cardRenderer.MousePosition();
  var pileX = 0.5 * (pile.xEnd + pile.xStart);
  var pileY = pile.yCards;
  //arbitrary offset to feel right
  if (player == runner) pileY -= 80;
  else pileY += 170; //this is not the centre of the pile (it's a bit above it)
  var diff = { x: mouse.x - pileX, y: mouse.y - pileY };
  var sqdist = diff.x * diff.x + diff.y * diff.y;
  return sqdist;
}

var pixi_playY = 180;
function pixi_playThreshold(cardToPlay) {
  if (cardToPlay != null) {
    if (executingCommand == "trash" || executingCommand == "discard") {
      //trash before install or discard at end of turn
      var pile = null;
      if (cardToPlay.card.player == corp) pile = corp.archives;
      else if (cardToPlay.card.player == runner) pile = runner.heap;
      return pixi_SqDistToPile(pile, cardToPlay.card.player) < 50000; //arbitrary to feel right
    } else if (
      activePlayer == corp &&
      cardToPlay.card == corp.RnD.cards[corp.RnD.cards.length - 1]
    ) {
      //corp drawing card
      return pixi_SqDistToPile(corp.RnD, corp) > 20000; //arbitrary to feel right
    }
    if (
      activePlayer == runner &&
      cardToPlay.card == runner.stack[runner.stack.length - 1]
    ) {
      //runner drawing card
      return pixi_SqDistToPile(runner.stack, runner) > 20000; //arbitrary to feel right
    }
    if (typeof cardToPlay.card.installOnlyOn === "function") {
      //install a card that needs to be hosted
      //check if any host is near enough to select (and determine closest in the process)
      var validHosts = ChoicesInstalledCards(
        null,
        cardToPlay.card.installOnlyOn
      ); //null means both players
      var closestHost = null;
      var closestSqDistance = 30000; //start with max distance
      for (var i = 0; i < validHosts.length; i++) {
        var xdiff = cardToPlay.sprite.x - validHosts[i].card.renderer.sprite.x;
        var ydiff = cardToPlay.sprite.y - validHosts[i].card.renderer.sprite.y;
        var sqDist = xdiff * xdiff + ydiff * ydiff;
        if (sqDist < closestSqDistance) {
          closestSqDistance = sqDist;
          closestHost = validHosts[i].card.renderer;
        }
      }
      //notify hosts of their closeness status
      for (var i = 0; i < validHosts.length; i++) {
        if (closestHost == validHosts[i].card.renderer)
          validHosts[i].card.renderer.isClosestHost = true;
        else validHosts[i].card.renderer.isClosestHost = false;
      }
      if (closestHost != null) return true;
      return false;
    }
    //maybe installing a corp card
    if (activePlayer == corp) {
      //installing?
      if (!CheckCardType(cardToPlay.card, ["operation"])) {
        for (var i = 0; i < validOptions.length; i++) {
          if (validOptions[i].card == cardToPlay.card) {
            if (MouseIsOverServer(validOptions[i].server)) return true;
          }
        }
        return false;
      }
    }
  }
  //nothing yet? maybe drag from hand to field
  var y = cardRenderer.MousePosition().y;
  if (activePlayer == corp) return y > pixi_playY;
  return y < cardRenderer.app.renderer.height - pixi_playY;
}
