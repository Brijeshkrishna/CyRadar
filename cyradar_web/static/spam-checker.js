/**
 * Copyright (c) 2016 Will Boyd
 *
 * This software is released under the MIT license: http://opensource.org/licenses/MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @author  Will Boyd
 * @github  https://github.com/lonekorean/highlight-within-textarea
 *
 * START(highlight-within-textarea)
 */

(function ($) {
  let ID = "hwt";

  let HighlightWithinTextarea = function ($el, config) {
    this.init($el, config);
  };

  HighlightWithinTextarea.prototype = {
    init: function ($el, config) {
      this.$el = $el;

      // backwards compatibility with v1 (deprecated)
      if (this.getType(config) === "function") {
        config = { highlight: config };
      }

      if (this.getType(config) === "custom") {
        this.highlight = config;
        this.generate();
      } else {
        console.error("valid config object not provided");
      }
    },

    // returns identifier strings that aren't necessarily "real" JavaScript types
    getType: function (instance) {
      let type = typeof instance;
      if (!instance) {
        return "falsey";
      } else if (Array.isArray(instance)) {
        if (instance.length === 2 && typeof instance[0] === "number" && typeof instance[1] === "number") {
          return "range";
        } else {
          return "array";
        }
      } else if (type === "object") {
        if (instance instanceof RegExp) {
          return "regexp";
        } else if (instance.hasOwnProperty("highlight")) {
          return "custom";
        }
      } else if (type === "function" || type === "string") {
        return type;
      }

      return "other";
    },

    generate: function () {
      this.$el
        .addClass(ID + "-input " + ID + "-content")
        .on("input." + ID, this.handleInput.bind(this))
        .on("scroll." + ID, this.handleScroll.bind(this));

      this.$highlights = $("<div>", { class: ID + "-highlights " + ID + "-content" });

      this.$backdrop = $("<div>", { class: ID + "-backdrop" }).append(this.$highlights);

      this.$container = $("<div>", { class: ID + "-container" })
        .insertAfter(this.$el)
        .append(this.$backdrop, this.$el) // moves $el into $container
        .on("scroll", this.blockContainerScroll.bind(this));

      this.browser = this.detectBrowser();
      switch (this.browser) {
        case "firefox":
          this.fixFirefox();
          break;
        case "ios":
          this.fixIOS();
          break;
      }

      // plugin function checks this for success
      this.isGenerated = true;

      // trigger input event to highlight any existing input
      this.handleInput();
    },

    // browser sniffing sucks, but there are browser-specific quirks to handle
    // that are not a matter of feature detection
    detectBrowser: function () {
      let ua = window.navigator.userAgent.toLowerCase();
      if (ua.indexOf("firefox") !== -1) {
        return "firefox";
      } else if (!!ua.match(/msie|trident\/7|edge/)) {
        return "ie";
      } else if (!!ua.match(/ipad|iphone|ipod/) && ua.indexOf("windows phone") === -1) {
        // Windows Phone flags itself as "like iPhone", thus the extra check
        return "ios";
      } else {
        return "other";
      }
    },

    // Firefox doesn't show text that scrolls into the padding of a textarea, so
    // rearrange a couple box models to make highlights behave the same way
    fixFirefox: function () {
      // take padding and border pixels from highlights div
      let padding = this.$highlights.css(["padding-top", "padding-right", "padding-bottom", "padding-left"]);
      let border = this.$highlights.css([
        "border-top-width",
        "border-right-width",
        "border-bottom-width",
        "border-left-width",
      ]);
      this.$highlights.css({
        padding: "0",
        "border-width": "0",
      });

      this.$backdrop
        .css({
          // give padding pixels to backdrop div
          "margin-top": "+=" + padding["padding-top"],
          "margin-right": "+=" + padding["padding-right"],
          "margin-bottom": "+=" + padding["padding-bottom"],
          "margin-left": "+=" + padding["padding-left"],
        })
        .css({
          // give border pixels to backdrop div
          "margin-top": "+=" + border["border-top-width"],
          "margin-right": "+=" + border["border-right-width"],
          "margin-bottom": "+=" + border["border-bottom-width"],
          "margin-left": "+=" + border["border-left-width"],
        });
    },

    // iOS adds 3px of (unremovable) padding to the left and right of a textarea,
    // so adjust highlights div to match
    fixIOS: function () {
      this.$highlights.css({
        "padding-left": "+=3px",
        "padding-right": "+=3px",
      });
    },

    handleInput: function () {
      let input = this.$el.val();
      let ranges = this.getRanges(input, this.highlight);
      let unstaggeredRanges = this.removeStaggeredRanges(ranges);
      let boundaries = this.getBoundaries(unstaggeredRanges);
      this.renderMarks(boundaries);
      this.renderAside(boundaries);
    },

    getRanges: function (input, highlight) {
      let type = this.getType(highlight);
      switch (type) {
        case "array":
          return this.getArrayRanges(input, highlight);
        case "function":
          return this.getFunctionRanges(input, highlight);
        case "regexp":
          return this.getRegExpRanges(input, highlight);
        case "string":
          return this.getStringRanges(input, highlight);
        case "range":
          return this.getRangeRanges(input, highlight);
        case "custom":
          return this.getCustomRanges(input, highlight);
        default:
          if (!highlight) {
            // do nothing for falsey values
            return [];
          } else {
            console.error("unrecognized highlight type");
          }
      }
    },

    getArrayRanges: function (input, arr) {
      let ranges = arr.map(this.getRanges.bind(this, input));
      return Array.prototype.concat.apply([], ranges);
    },

    getFunctionRanges: function (input, func) {
      return this.getRanges(input, func(input));
    },

    getRegExpRanges: function (input, regex) {
      let ranges = [];
      let match;
      while (((match = regex.exec(input)), match !== null)) {
        ranges.push([match.index, match.index + match[0].length]);
        if (!regex.global) {
          // non-global regexes do not increase lastIndex, causing an infinite loop,
          // but we can just break manually after the first match
          break;
        }
      }
      return ranges;
    },

    getStringRanges: function (input, str) {
      let ranges = [];
      let inputLower = input.toLowerCase();
      let strLower = str.toLowerCase();
      let index = 0;
      while (((index = inputLower.indexOf(strLower, index)), index !== -1)) {
        ranges.push([index, index + strLower.length]);
        index += strLower.length;
      }
      return ranges;
    },

    getRangeRanges: function (input, range) {
      return [range];
    },

    getCustomRanges: function (input, custom) {
      let ranges = this.getRanges(input, custom.highlight);

      if (custom.category) {
        ranges.forEach(function (range) {
          // persist class name as a property of the array
          if (range.category) {
            range.category = custom.category + " " + range.category;
          } else {
            range.category = custom.category;
          }

          range.highlight = custom.highlight;
          range.keyword = custom.keyword;
        });
      }

      return ranges;
    },

    // prevent staggered overlaps (clean nesting is fine)
    removeStaggeredRanges: function (ranges) {
      let unstaggeredRanges = [];
      ranges.forEach(function (range) {
        let isStaggered = unstaggeredRanges.some(function (unstaggeredRange) {
          let isStartInside = range[0] > unstaggeredRange[0] && range[0] < unstaggeredRange[1];
          let isStopInside = range[1] > unstaggeredRange[0] && range[1] < unstaggeredRange[1];
          return isStartInside !== isStopInside; // xor
        });
        if (!isStaggered) {
          unstaggeredRanges.push(range);
        }
      });
      return unstaggeredRanges;
    },

    getBoundaries: function (ranges) {
      let boundaries = [];
      ranges.forEach(function (range) {
        // console.log(range);
        boundaries.push({
          type: "start",
          index: range[0],
          highlight: range.highlight,
          keyword: range.keyword,
          category: range.category,
        });
        boundaries.push({
          type: "stop",
          index: range[1],
        });
      });

      this.sortBoundaries(boundaries);
      return boundaries;
    },

    sortBoundaries: function (boundaries) {
      // backwards sort (since marks are inserted right to left)
      boundaries.sort(function (a, b) {
        if (a.index !== b.index) {
          return b.index - a.index;
        } else if (a.type === "stop" && b.type === "start") {
          return 1;
        } else if (a.type === "start" && b.type === "stop") {
          return -1;
        } else {
          return 0;
        }
      });
    },

    renderMarks: function (boundaries) {
      let input = this.$el.val();
      boundaries.forEach(function (boundary, index) {
        let markup;
        if (boundary.type === "start") {
          markup = "{{hwt-mark-start|" + index + "}}";
        } else {
          markup = "{{hwt-mark-stop}}";
        }
        input = input.slice(0, boundary.index) + markup + input.slice(boundary.index);
      });

      // this keeps scrolling aligned when input ends with a newline
      input = input.replace(/\n(\{\{hwt-mark-stop\}\})?$/, "\n\n$1");

      // encode HTML entities
      input = input.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      if (this.browser === "ie") {
        // IE/Edge wraps whitespace differently in a div vs textarea, this fixes it
        input = input.replace(/ /g, " <wbr>");
      }

      // replace start tokens with opening <mark> tags with class name
      input = input.replace(/\{\{hwt-mark-start\|(\d+)\}\}/g, function (match, submatch) {
        var category = boundaries[+submatch].category;
        if (category) {
          return '<mark class="spam-category-' + category + '">';
        } else {
          return "<mark>";
        }
      });

      // replace stop tokens with closing </mark> tags
      input = input.replace(/\{\{hwt-mark-stop\}\}/g, "</mark>");

      this.$highlights.html(input);
    },

    renderAside: function (boundaries) {
      // Metadata
      const input = this.$el.val();
      const totalWords = input.split(/\s+/).length - 1;
      const readtime = Math.round(totalWords / 200);

      if (totalWords < 2) {
        $("#spam-checker--aside").html(
          "<i style='color:black' >Add content to get your spam score.</i>"
        );
        return;
      }

      let table = "";
      
      table += "<tr><td style='color:black'>Words:</td><td style='color:#292a2d'>" + totalWords + "</td></tr>";
      table += "<tr><td style='color:black'>Read Time:</td><td style='color:#292a2d'>" + (readtime ? readtime + " Min" : "Few Seconds") + "</td></tr>";

      // List categories
      const categories = {};
      let totalSpamHits = 0;
      boundaries.forEach((range) => {
        if (!range.category) {
          return;
        }

        const category = range.category;
        categories[category] = categories[category] || { type: category, keywords: [] };
        categories[category].keywords.push({ keyword: range.keyword });

        totalSpamHits++;
      });

      let list = "";

      for (const hash in categories) {
        const category = categories[hash];
        let categoryName = "";
        let categorycolor = ""

        switch (category.type) {
          case "overpromise":
            categoryName = "🤩 Overpromise ";
            categorycolor = '#1d7103'
            break;
          case "urgency":
            categoryName = "🚨 Urgency ";
            categorycolor = "#a50505"
            break;
          case "money":
            categoryName = "💰 Money ";
            categorycolor = "#6d0374"
            break;
          case "shady":
            categoryName = "🔞 Shady ";
            categorycolor = "#6c5e03"
            break;
          case "unnatural":
            categoryName = "💬 Unnatural ";
            categorycolor = "#0648ad"
            break;
          default:
            continue;
        }

        list +=
          "<li class='spam-category-" +
          category.type +
          "' style='color:" + categorycolor + "; border:solid black 1px'>" +
          categoryName +
          "<span>(" +
          category.keywords.length +
          ")</span></li>";
      }

      // Score (great, okay, poor)
      let score = totalSpamHits;

      if (categories["money"] || categories["shady"]) {
        score += 20;
      }

      if (categories["urgency"] || categories["overpromise"]) {
        score += 10;
      }

      const scoreAsHtml =
        score > 20
          ? "<span class='text-poor'>Poor</span>"
          : score > 5
          ? "<span classs='text-okay'>Okay</span>"
          : "<span class='text-great'>Great</span>";

      table = "<tr><td style='color:black'>Percentage:</td><td id='tfmodel' style='color:#292a2d'>" + "xx%" + 
      "</td></tr>" +"<tr><td style='color:black'>Score:</td><td id='tfmodels' >" + scoreAsHtml + "</td></tr>" + table;

      // Append to HTML
      list = `<ul>${list}</ul>`;
      table = "<table>" + table + "</table><button style='margin-top: 40px;' id='myButton' onclick='clicker()' >Check</button> ";

      $("#spam-checker--aside").html(table + list);
    },

    handleScroll: function () {
      let scrollTop = this.$el.scrollTop();
      this.$backdrop.scrollTop(scrollTop);

      // Chrome and Safari won't break long strings of spaces, which can cause
      // horizontal scrolling, this compensates by shifting highlights by the
      // horizontally scrolled amount to keep things aligned
      let scrollLeft = this.$el.scrollLeft();
      this.$backdrop.css("transform", scrollLeft > 0 ? "translateX(" + -scrollLeft + "px)" : "");
    },

    // in Chrome, page up/down in the textarea will shift stuff within the
    // container (despite the CSS), this immediately reverts the shift
    blockContainerScroll: function () {
      this.$container.scrollLeft(0);
    },

    destroy: function () {
      this.$backdrop.remove();
      this.$el
        .unwrap()
        .removeClass(ID + "-text " + ID + "-input")
        .off(ID)
        .removeData(ID);
    },
  };

  // register the jQuery plugin
  $.fn.highlightWithinTextarea = function (options) {
    return this.each(function () {
      let $this = $(this);
      let plugin = $this.data(ID);

      if (typeof options === "string") {
        if (plugin) {
          switch (options) {
            case "update":
              plugin.handleInput();
              break;
            case "destroy":
              plugin.destroy();
              break;
            default:
              console.error("unrecognized method string");
          }
        } else {
          console.error("plugin must be instantiated first");
        }
      } else {
        if (plugin) {
          plugin.destroy();
        }
        plugin = new HighlightWithinTextarea($this, options);
        if (plugin.isGenerated) {
          $this.data(ID, plugin);
        }
      }
    });
  };

  /**
   * END(highlight-within-textarea)
   */

  /**
   * Copyright (c) 2021 Mailmeteor SAS - All rights reserved.
   *
   * @author  Mailmeteor SAS
   *
   * START(spam-words-checker)
   */

  $(function () {
    $("#spam-checker--textarea").highlightWithinTextarea({
      highlight: [
        { highlight: /\baccess\b/gi, keyword: "Access", category: "urgency" },
        { highlight: /\baccess now\b/gi, keyword: "Access now", category: "urgency" },
        { highlight: /\bact\b/gi, keyword: "Act", category: "urgency" },
        { highlight: /\bact immediately\b/gi, keyword: "Act immediately", category: "urgency" },
        { highlight: /\bact now\b/gi, keyword: "Act now", category: "urgency" },
        { highlight: /\bact now!\b/gi, keyword: "Act now!", category: "urgency" },
        { highlight: /\baction\b/gi, keyword: "Action", category: "urgency" },
        { highlight: /\baction required\b/gi, keyword: "Action required", category: "urgency" },
        { highlight: /\bapply here\b/gi, keyword: "Apply here", category: "urgency" },
        { highlight: /\bapply now\b/gi, keyword: "Apply now", category: "urgency" },
        { highlight: /\bapply now!\b/gi, keyword: "Apply now!", category: "urgency" },
        { highlight: /\bapply online\b/gi, keyword: "Apply online", category: "urgency" },
        { highlight: /\basap\b/gi, keyword: "ASAP", category: "urgency" },
        { highlight: /\bbecome a member\b/gi, keyword: "Become a member", category: "urgency" },
        { highlight: /\bbefore it's too late\b/gi, keyword: "Before it's too late", category: "urgency" },
        { highlight: /\bbeing a member\b/gi, keyword: "Being a member", category: "urgency" },
        { highlight: /\bbuy\b/gi, keyword: "Buy", category: "urgency" },
        { highlight: /\bbuy direct\b/gi, keyword: "Buy direct", category: "urgency" },
        { highlight: /\bbuy now\b/gi, keyword: "Buy now", category: "urgency" },
        { highlight: /\bbuy today\b/gi, keyword: "Buy today", category: "urgency" },
        { highlight: /\bcall\b/gi, keyword: "Call", category: "urgency" },
        { highlight: /\bcall free\b/gi, keyword: "Call free", category: "urgency" },
        { highlight: /\bcall (free|now)\b/gi, keyword: "Call free/now", category: "urgency" },
        { highlight: /\bcall me\b/gi, keyword: "Call me", category: "urgency" },
        { highlight: /\bcall now\b/gi, keyword: "Call now", category: "urgency" },
        { highlight: /\bcall now!\b/gi, keyword: "Call now!", category: "urgency" },
        {
          highlight: /\bcan we have a minute of your time\?\b/gi,
          keyword: "Can we have a minute of your time?",
          category: "urgency",
        },
        { highlight: /\bcancel now\b/gi, keyword: "Cancel now", category: "urgency" },
        { highlight: /\bcancellation required\b/gi, keyword: "Cancellation required", category: "urgency" },
        { highlight: /\bclaim now\b/gi, keyword: "Claim now", category: "urgency" },
        { highlight: /\bclick\b/gi, keyword: "Click", category: "urgency" },
        { highlight: /\bclick below\b/gi, keyword: "Click below", category: "urgency" },
        { highlight: /\bclick here\b/gi, keyword: "Click here", category: "urgency" },
        { highlight: /\bclick me to download\b/gi, keyword: "Click me to download", category: "urgency" },
        { highlight: /\bclick now\b/gi, keyword: "Click now", category: "urgency" },
        { highlight: /\bclick this link\b/gi, keyword: "Click this link", category: "urgency" },
        { highlight: /\bclick to get\b/gi, keyword: "Click to get", category: "urgency" },
        { highlight: /\bclick to remove\b/gi, keyword: "Click to remove", category: "urgency" },
        { highlight: /\bcontact us immediately\b/gi, keyword: "Contact us immediately", category: "urgency" },
        { highlight: /\bdeal ending soon\b/gi, keyword: "Deal ending soon", category: "urgency" },
        { highlight: /\bdo it now\b/gi, keyword: "Do it now", category: "urgency" },
        { highlight: /\bdo it today\b/gi, keyword: "Do it today", category: "urgency" },
        { highlight: /\bdon't delete\b/gi, keyword: "Don't delete", category: "urgency" },
        { highlight: /\bdon't hesitate\b/gi, keyword: "Don't hesitate", category: "urgency" },
        { highlight: /\bdon't waste time\b/gi, keyword: "Don't waste time", category: "urgency" },
        { highlight: /\bdon’t delete\b/gi, keyword: "Don’t delete", category: "urgency" },
        { highlight: /\bexclusive deal\b/gi, keyword: "Exclusive deal", category: "urgency" },
        { highlight: /\bexpire\b/gi, keyword: "Expire", category: "urgency" },
        { highlight: /\bexpires today\b/gi, keyword: "Expires today", category: "urgency" },
        { highlight: /\bfinal call\b/gi, keyword: "Final call", category: "urgency" },
        { highlight: /\bfor instant access\b/gi, keyword: "For instant access", category: "urgency" },
        { highlight: /\bfor only\b/gi, keyword: "For Only", category: "urgency" },
        { highlight: /\bfor you\b/gi, keyword: "For you", category: "urgency" },
        { highlight: /\bfriday before [holiday]\b/gi, keyword: "Friday before [holiday]", category: "urgency" },
        { highlight: /\bget it away\b/gi, keyword: "Get it away", category: "urgency" },
        { highlight: /\bget it now\b/gi, keyword: "Get it now", category: "urgency" },
        { highlight: /\bget now\b/gi, keyword: "Get now", category: "urgency" },
        { highlight: /\bget paid\b/gi, keyword: "Get paid", category: "urgency" },
        { highlight: /\bget started\b/gi, keyword: "Get started", category: "urgency" },
        { highlight: /\bget started now\b/gi, keyword: "Get started now", category: "urgency" },
        { highlight: /\bgreat offer\b/gi, keyword: "Great offer", category: "urgency" },
        { highlight: /\bhurry up\b/gi, keyword: "Hurry up", category: "urgency" },
        { highlight: /\bimmediately\b/gi, keyword: "Immediately", category: "urgency" },
        { highlight: /\binfo you requested\b/gi, keyword: "Info you requested", category: "urgency" },
        { highlight: /\binformation you requested\b/gi, keyword: "Information you requested", category: "urgency" },
        { highlight: /\binstant\b/gi, keyword: "Instant", category: "urgency" },
        { highlight: /\blimited time\b/gi, keyword: "Limited time", category: "urgency" },
        { highlight: /\bnew customers only\b/gi, keyword: "New customers only", category: "urgency" },
        { highlight: /\bnow\b/gi, keyword: "Now", category: "urgency" },
        { highlight: /\bnow only\b/gi, keyword: "Now only", category: "urgency" },
        { highlight: /\boffer expires\b/gi, keyword: "Offer expires", category: "urgency" },
        { highlight: /\bonce in lifetime\b/gi, keyword: "Once in lifetime", category: "urgency" },
        { highlight: /\bonly\b/gi, keyword: "Only", category: "urgency" },
        { highlight: /\border now\b/gi, keyword: "Order now", category: "urgency" },
        { highlight: /\border today\b/gi, keyword: "Order today", category: "urgency" },
        { highlight: /\bplease read\b/gi, keyword: "Please read", category: "urgency" },
        { highlight: /\bpurchase now\b/gi, keyword: "Purchase now", category: "urgency" },
        { highlight: /\bsign up free\b/gi, keyword: "Sign up free", category: "urgency" },
        { highlight: /\bsign up free today\b/gi, keyword: "Sign up free today", category: "urgency" },
        { highlight: /\bsupplies are limited\b/gi, keyword: "Supplies are limited", category: "urgency" },
        { highlight: /\btake action\b/gi, keyword: "Take action", category: "urgency" },
        { highlight: /\btake action now\b/gi, keyword: "Take action now", category: "urgency" },
        { highlight: /\bthis won’t last\b/gi, keyword: "This won’t last", category: "urgency" },
        { highlight: /\btime limited\b/gi, keyword: "Time limited", category: "urgency" },
        { highlight: /\btoday\b/gi, keyword: "Today", category: "urgency" },
        { highlight: /\btop urgent\b/gi, keyword: "Top urgent", category: "urgency" },
        { highlight: /\btrial\b/gi, keyword: "Trial", category: "urgency" },
        { highlight: /\burgent\b/gi, keyword: "Urgent", category: "urgency" },
        { highlight: /\bwhat are you waiting for\?\b/gi, keyword: "What are you waiting for?", category: "urgency" },
        { highlight: /\bwhile supplies last\b/gi, keyword: "While supplies last", category: "urgency" },
        { highlight: /\byou are a winner\b/gi, keyword: "You are a winner", category: "urgency" },
        { highlight: /\b0 down\b/gi, keyword: "0 down", category: "shady" },
        { highlight: /\ball\b/gi, keyword: "All", category: "shady" },
        { highlight: /\ball natural\b/gi, keyword: "All natural", category: "shady" },
        { highlight: /\ball (natural|new)\b/gi, keyword: "All natural/new", category: "shady" },
        { highlight: /\ball new\b/gi, keyword: "All new", category: "shady" },
        { highlight: /\ball-natural\b/gi, keyword: "All-natural", category: "shady" },
        { highlight: /\ball-new\b/gi, keyword: "All-new", category: "shady" },
        { highlight: /\ballowance\b/gi, keyword: "Allowance", category: "shady" },
        { highlight: /\bas seen on\b/gi, keyword: "As seen on", category: "shady" },
        { highlight: /\bas seen on oprah\b/gi, keyword: "As seen on Oprah", category: "shady" },
        { highlight: /\bat no cost\b/gi, keyword: "At no cost", category: "shady" },
        { highlight: /\bauto email removal\b/gi, keyword: "Auto email removal", category: "shady" },
        { highlight: /\bavoice bankruptcy\b/gi, keyword: "Avoice bankruptcy", category: "shady" },
        { highlight: /\bavoid\b/gi, keyword: "Avoid", category: "shady" },
        { highlight: /\bbeneficial offer\b/gi, keyword: "Beneficial offer", category: "shady" },
        { highlight: /\bbeneficiary\b/gi, keyword: "Beneficiary", category: "shady" },
        { highlight: /\bbill 1618\b/gi, keyword: "Bill 1618", category: "shady" },
        { highlight: /\bbrand new pager\b/gi, keyword: "Brand new pager", category: "shady" },
        { highlight: /\bbulk email\b/gi, keyword: "Bulk email", category: "shady" },
        { highlight: /\bbuying judgements\b/gi, keyword: "Buying judgements", category: "shady" },
        { highlight: /\bbuying judgments\b/gi, keyword: "Buying judgments", category: "shady" },
        { highlight: /\bcable converter\b/gi, keyword: "Cable converter", category: "shady" },
        { highlight: /\bcalling creditors\b/gi, keyword: "Calling creditors", category: "shady" },
        { highlight: /\bcan you help us\?\b/gi, keyword: "Can you help us?", category: "shady" },
        { highlight: /\bcancel at any time\b/gi, keyword: "Cancel at any time", category: "shady" },
        { highlight: /\bcannot be combined\b/gi, keyword: "Cannot be combined", category: "shady" },
        { highlight: /\bcelebrity\b/gi, keyword: "Celebrity", category: "shady" },
        { highlight: /\bcell phone cancer scam\b/gi, keyword: "Cell phone cancer scam", category: "shady" },
        { highlight: /\bcertified\b/gi, keyword: "Certified", category: "shady" },
        { highlight: /\bchance\b/gi, keyword: "Chance", category: "shady" },
        { highlight: /\bcheap\b/gi, keyword: "Cheap", category: "shady" },
        { highlight: /\bcheap meds\b/gi, keyword: "Cheap meds", category: "shady" },
        { highlight: /\bcialis\b/gi, keyword: "Cialis", category: "shady" },
        { highlight: /\bclaims\b/gi, keyword: "Claims", category: "shady" },
        {
          highlight: /\bclaims not to be selling anything\b/gi,
          keyword: "Claims not to be selling anything",
          category: "shady",
        },
        {
          highlight: /\bclaims to be in accordance with some spam law\b/gi,
          keyword: "Claims to be in accordance with some spam law",
          category: "shady",
        },
        { highlight: /\bclaims to be legal\b/gi, keyword: "Claims to be legal", category: "shady" },
        { highlight: /\bclearance\b/gi, keyword: "Clearance", category: "shady" },
        { highlight: /\bcollect\b/gi, keyword: "Collect", category: "shady" },
        { highlight: /\bcollect child support\b/gi, keyword: "Collect child support", category: "shady" },
        { highlight: /\bcompare\b/gi, keyword: "Compare", category: "shady" },
        { highlight: /\bcompare now\b/gi, keyword: "Compare now", category: "shady" },
        { highlight: /\bcompare online\b/gi, keyword: "Compare online", category: "shady" },
        { highlight: /\bcompare rates\b/gi, keyword: "Compare rates", category: "shady" },
        { highlight: /\bcompete for your business\b/gi, keyword: "Compete for your business", category: "shady" },
        { highlight: /\bconfidentiality\b/gi, keyword: "Confidentiality", category: "shady" },
        { highlight: /\bcongratulations\b/gi, keyword: "Congratulations", category: "shady" },
        { highlight: /\bconsolidate debt and credit\b/gi, keyword: "Consolidate debt and credit", category: "shady" },
        { highlight: /\bconsolidate your debt\b/gi, keyword: "Consolidate your debt", category: "shady" },
        { highlight: /\bcopy accurately\b/gi, keyword: "Copy accurately", category: "shady" },
        { highlight: /\bcopy dvds\b/gi, keyword: "Copy DVDs", category: "shady" },
        { highlight: /\bcovid\b/gi, keyword: "COVID", category: "shady" },
        { highlight: /\bcures\b/gi, keyword: "Cures", category: "shady" },
        { highlight: /\bcures baldness\b/gi, keyword: "Cures baldness", category: "shady" },
        { highlight: /\bdiagnostic\b/gi, keyword: "Diagnostic", category: "shady" },
        { highlight: /\bdiagnostics\b/gi, keyword: "DIAGNOSTICS", category: "shady" },
        { highlight: /\bdiet\b/gi, keyword: "Diet", category: "shady" },
        { highlight: /\bdig up dirt on friends\b/gi, keyword: "Dig up dirt on friends", category: "shady" },
        { highlight: /\bdirect email\b/gi, keyword: "Direct email", category: "shady" },
        { highlight: /\bdirect marketing\b/gi, keyword: "Direct marketing", category: "shady" },
        { highlight: /\beliminate debt\b/gi, keyword: "Eliminate debt", category: "shady" },
        { highlight: /\bexplode your business\b/gi, keyword: "Explode your business", category: "shady" },
        { highlight: /\bfast viagra delivery\b/gi, keyword: "Fast viagra delivery", category: "shady" },
        { highlight: /\bfinance\b/gi, keyword: "Finance", category: "shady" },
        { highlight: /\bfinancial\b/gi, keyword: "Financial", category: "shady" },
        { highlight: /\bfinancial advice\b/gi, keyword: "Financial advice", category: "shady" },
        { highlight: /\bfinancial independence\b/gi, keyword: "Financial independence", category: "shady" },
        { highlight: /\bfinancially independent\b/gi, keyword: "Financially independent", category: "shady" },
        { highlight: /\bfor new customers only\b/gi, keyword: "For new customers only", category: "shady" },
        { highlight: /\bforeclosure\b/gi, keyword: "Foreclosure", category: "shady" },
        { highlight: /\bfree\b/gi, keyword: "Free", category: "shady" },
        { highlight: /\bfree (access|money|gift)\b/gi, keyword: "Free access/money/gift", category: "shady" },
        { highlight: /\bfree bonus\b/gi, keyword: "Free bonus", category: "shady" },
        { highlight: /\bfree cell phone\b/gi, keyword: "Free cell phone", category: "shady" },
        { highlight: /\bfree dvd\b/gi, keyword: "Free DVD", category: "shady" },
        { highlight: /\bfree grant money\b/gi, keyword: "Free grant money", category: "shady" },
        { highlight: /\bfree information\b/gi, keyword: "Free information", category: "shady" },
        { highlight: /\bfree installation\b/gi, keyword: "Free installation", category: "shady" },
        { highlight: /\bfree instant\b/gi, keyword: "Free Instant", category: "shady" },
        { highlight: /\bfree iphone\b/gi, keyword: "Free iPhone", category: "shady" },
        { highlight: /\bfree laptop\b/gi, keyword: "Free laptop", category: "shady" },
        { highlight: /\bfree leads\b/gi, keyword: "Free leads", category: "shady" },
        { highlight: /\bfree macbook\b/gi, keyword: "Free Macbook", category: "shady" },
        { highlight: /\bfree offer\b/gi, keyword: "Free offer", category: "shady" },
        { highlight: /\bfree priority mail\b/gi, keyword: "Free priority mail", category: "shady" },
        { highlight: /\bfree sample\b/gi, keyword: "Free sample", category: "shady" },
        { highlight: /\bfree website\b/gi, keyword: "Free website", category: "shady" },
        { highlight: /\bfree!\b/gi, keyword: "Free!", category: "shady" },
        { highlight: /\bget\b/gi, keyword: "Get", category: "shady" },
        { highlight: /\bgift card\b/gi, keyword: "Gift card", category: "shady" },
        { highlight: /\bgift certificate\b/gi, keyword: "Gift certificate", category: "shady" },
        { highlight: /\bgift included\b/gi, keyword: "Gift included", category: "shady" },
        { highlight: /\bgive it away\b/gi, keyword: "Give it away", category: "shady" },
        { highlight: /\bgiving away\b/gi, keyword: "Giving away", category: "shady" },
        { highlight: /\bgiving it away\b/gi, keyword: "Giving it away", category: "shady" },
        { highlight: /\bgold\b/gi, keyword: "Gold", category: "shady" },
        { highlight: /\bgreat\b/gi, keyword: "Great", category: "shady" },
        { highlight: /\bgreat deal\b/gi, keyword: "Great deal", category: "shady" },
        { highlight: /\bgreetings of the day\b/gi, keyword: "Greetings of the day", category: "shady" },
        { highlight: /\bgrowth hormone\b/gi, keyword: "Growth hormone", category: "shady" },
        { highlight: /\bguarantee\b/gi, keyword: "Guarantee", category: "shady" },
        { highlight: /\bguaranteed deposit\b/gi, keyword: "Guaranteed deposit", category: "shady" },
        { highlight: /\bguaranteed income\b/gi, keyword: "Guaranteed income", category: "shady" },
        { highlight: /\bguaranteed payment\b/gi, keyword: "Guaranteed payment", category: "shady" },
        { highlight: /\bhave you been turned down\?\b/gi, keyword: "Have you been turned down?", category: "shady" },
        {
          highlight: /\bhello (with no name included)\b/gi,
          keyword: "Hello (with no name included)",
          category: "shady",
        },
        { highlight: /\bhidden charges\b/gi, keyword: "Hidden charges", category: "shady" },
        { highlight: /\bhidden costs\b/gi, keyword: "Hidden costs", category: "shady" },
        { highlight: /\bhidden fees\b/gi, keyword: "Hidden fees", category: "shady" },
        { highlight: /\bhigh score\b/gi, keyword: "High score", category: "shady" },
        { highlight: /\bhome based business\b/gi, keyword: "Home based business", category: "shady" },
        { highlight: /\bhome mortgage\b/gi, keyword: "Home mortgage", category: "shady" },
        { highlight: /\bhuman\b/gi, keyword: "Human", category: "shady" },
        { highlight: /\bhuman growth hormone\b/gi, keyword: "Human growth hormone", category: "shady" },
        { highlight: /\bif only it were that easy\b/gi, keyword: "If only it were that easy", category: "shady" },
        { highlight: /\bimportant information\b/gi, keyword: "Important information", category: "shady" },
        { highlight: /\bimportant notification\b/gi, keyword: "Important notification", category: "shady" },
        { highlight: /\binstant weight loss\b/gi, keyword: "Instant weight loss", category: "shady" },
        { highlight: /\binsurance lose weight\b/gi, keyword: "Insurance Lose weight", category: "shady" },
        { highlight: /\binternet marketing\b/gi, keyword: "Internet marketing", category: "shady" },
        { highlight: /\binvestment decision\b/gi, keyword: "Investment decision", category: "shady" },
        { highlight: /\binvoice\b/gi, keyword: "Invoice", category: "shady" },
        { highlight: /\bit’s effective\b/gi, keyword: "It’s effective", category: "shady" },
        { highlight: /\bjob alert\b/gi, keyword: "Job alert", category: "shady" },
        { highlight: /\bjunk\b/gi, keyword: "Junk", category: "shady" },
        { highlight: /\blambo\b/gi, keyword: "Lambo", category: "shady" },
        { highlight: /\blaser printer\b/gi, keyword: "Laser printer", category: "shady" },
        { highlight: /\blast day\b/gi, keyword: "Last Day", category: "shady" },
        { highlight: /\blegal\b/gi, keyword: "Legal", category: "shady" },
        { highlight: /\blegal notice\b/gi, keyword: "Legal notice", category: "shady" },
        { highlight: /\blife\b/gi, keyword: "Life", category: "shady" },
        { highlight: /\blife insurance\b/gi, keyword: "Life insurance", category: "shady" },
        { highlight: /\blifetime access\b/gi, keyword: "Lifetime access", category: "shady" },
        { highlight: /\blifetime deal\b/gi, keyword: "Lifetime deal", category: "shady" },
        { highlight: /\blimited\b/gi, keyword: "Limited", category: "shady" },
        { highlight: /\blimited amount\b/gi, keyword: "Limited amount", category: "shady" },
        { highlight: /\blimited number\b/gi, keyword: "Limited number", category: "shady" },
        { highlight: /\blimited offer\b/gi, keyword: "Limited offer", category: "shady" },
        { highlight: /\blimited supply\b/gi, keyword: "Limited supply", category: "shady" },
        { highlight: /\blimited time offer\b/gi, keyword: "Limited time offer", category: "shady" },
        { highlight: /\blimited time only\b/gi, keyword: "Limited time only", category: "shady" },
        { highlight: /\bloan\b/gi, keyword: "Loan", category: "shady" },
        { highlight: /\blong distance phone number\b/gi, keyword: "Long distance phone number", category: "shady" },
        { highlight: /\blong distance phone offer\b/gi, keyword: "Long distance phone offer", category: "shady" },
        { highlight: /\blose weight\b/gi, keyword: "Lose weight", category: "shady" },
        { highlight: /\blose weight fast\b/gi, keyword: "Lose weight fast", category: "shady" },
        { highlight: /\blose weight spam\b/gi, keyword: "Lose weight spam", category: "shady" },
        { highlight: /\blottery\b/gi, keyword: "Lottery", category: "shady" },
        { highlight: /\blower interest rate\b/gi, keyword: "Lower interest rate", category: "shady" },
        { highlight: /\blower interest rates\b/gi, keyword: "Lower interest rates", category: "shady" },
        { highlight: /\blower monthly payment\b/gi, keyword: "Lower monthly payment", category: "shady" },
        { highlight: /\blower your mortgage rate\b/gi, keyword: "Lower your mortgage rate", category: "shady" },
        { highlight: /\blowest insurance rates\b/gi, keyword: "Lowest insurance rates", category: "shady" },
        { highlight: /\blowest interest rate\b/gi, keyword: "Lowest interest rate", category: "shady" },
        { highlight: /\blowest rate\b/gi, keyword: "Lowest rate", category: "shady" },
        { highlight: /\blowest rates\b/gi, keyword: "Lowest rates", category: "shady" },
        { highlight: /\bluxury\b/gi, keyword: "Luxury", category: "shady" },
        { highlight: /\bluxury car\b/gi, keyword: "Luxury car", category: "shady" },
        { highlight: /\bmail in order form\b/gi, keyword: "Mail in order form", category: "shady" },
        { highlight: /\bmain in order form\b/gi, keyword: "Main in order form", category: "shady" },
        { highlight: /\bmark this as not junk\b/gi, keyword: "Mark this as not junk", category: "shady" },
        { highlight: /\bmass email\b/gi, keyword: "Mass email", category: "shady" },
        { highlight: /\bmedical\b/gi, keyword: "Medical", category: "shady" },
        { highlight: /\bmedicine\b/gi, keyword: "Medicine", category: "shady" },
        { highlight: /\bmeet girls\b/gi, keyword: "Meet girls", category: "shady" },
        { highlight: /\bmeet me\b/gi, keyword: "Meet me", category: "shady" },
        { highlight: /\bmeet singles\b/gi, keyword: "Meet singles", category: "shady" },
        { highlight: /\bmeet women\b/gi, keyword: "Meet women", category: "shady" },
        { highlight: /\bmember\b/gi, keyword: "Member", category: "shady" },
        { highlight: /\bmember stuff\b/gi, keyword: "Member stuff", category: "shady" },
        { highlight: /\bmessage contains disclaimer\b/gi, keyword: "Message contains disclaimer", category: "shady" },
        { highlight: /\bmessage from\b/gi, keyword: "Message from", category: "shady" },
        { highlight: /\bmillionaire\b/gi, keyword: "Millionaire", category: "shady" },
        { highlight: /\bmillions\b/gi, keyword: "Millions", category: "shady" },
        { highlight: /\bmlm\b/gi, keyword: "MLM", category: "shady" },
        { highlight: /\bmulti-level marketing\b/gi, keyword: "Multi-level marketing", category: "shady" },
        { highlight: /\bname\b/gi, keyword: "Name", category: "shady" },
        { highlight: /\bnear you\b/gi, keyword: "Near you", category: "shady" },
        { highlight: /\bnever before\b/gi, keyword: "Never before", category: "shady" },
        { highlight: /\bnew\b/gi, keyword: "New", category: "shady" },
        { highlight: /\bnew domain extensions\b/gi, keyword: "New domain extensions", category: "shady" },
        { highlight: /\bnigerian\b/gi, keyword: "Nigerian", category: "shady" },
        { highlight: /\bno age restrictions\b/gi, keyword: "No age restrictions", category: "shady" },
        { highlight: /\bno catch\b/gi, keyword: "No catch", category: "shady" },
        { highlight: /\bno claim forms\b/gi, keyword: "No claim forms", category: "shady" },
        { highlight: /\bno cost\b/gi, keyword: "No cost", category: "shady" },
        { highlight: /\bno credit check\b/gi, keyword: "No credit check", category: "shady" },
        { highlight: /\bno credit experience\b/gi, keyword: "No credit experience", category: "shady" },
        { highlight: /\bno deposit required\b/gi, keyword: "No deposit required", category: "shady" },
        { highlight: /\bno disappointment\b/gi, keyword: "No disappointment", category: "shady" },
        { highlight: /\bno experience\b/gi, keyword: "No experience", category: "shady" },
        { highlight: /\bno fees\b/gi, keyword: "No fees", category: "shady" },
        { highlight: /\bno gimmick\b/gi, keyword: "No gimmick", category: "shady" },
        { highlight: /\bno hidden\b/gi, keyword: "No hidden", category: "shady" },
        { highlight: /\bno hidden costs\b/gi, keyword: "No hidden costs", category: "shady" },
        { highlight: /\bno hidden fees\b/gi, keyword: "No hidden fees", category: "shady" },
        { highlight: /\bno hidden сosts\b/gi, keyword: "No hidden сosts", category: "shady" },
        { highlight: /\bno interest\b/gi, keyword: "No interest", category: "shady" },
        { highlight: /\bno interests\b/gi, keyword: "No interests", category: "shady" },
        { highlight: /\bno inventory\b/gi, keyword: "No inventory", category: "shady" },
        { highlight: /\bno investment\b/gi, keyword: "No investment", category: "shady" },
        { highlight: /\bno investment required\b/gi, keyword: "No investment required", category: "shady" },
        { highlight: /\bno medical exams\b/gi, keyword: "No medical exams", category: "shady" },
        { highlight: /\bno middleman\b/gi, keyword: "No middleman", category: "shady" },
        { highlight: /\bno obligation\b/gi, keyword: "No obligation", category: "shady" },
        { highlight: /\bno payment required\b/gi, keyword: "No payment required", category: "shady" },
        { highlight: /\bno purchase necessary\b/gi, keyword: "No purchase necessary", category: "shady" },
        { highlight: /\bno questions asked\b/gi, keyword: "No questions asked", category: "shady" },
        { highlight: /\bno selling\b/gi, keyword: "No selling", category: "shady" },
        { highlight: /\bno strings attached\b/gi, keyword: "No strings attached", category: "shady" },
        { highlight: /\bno-obligation\b/gi, keyword: "No-obligation", category: "shady" },
        { highlight: /\bnominated bank account\b/gi, keyword: "Nominated bank account", category: "shady" },
        { highlight: /\bnot intended\b/gi, keyword: "Not intended", category: "shady" },
        { highlight: /\bnot junk\b/gi, keyword: "Not junk", category: "shady" },
        { highlight: /\bnot scam\b/gi, keyword: "Not scam", category: "shady" },
        { highlight: /\bnot spam\b/gi, keyword: "Not spam", category: "shady" },
        { highlight: /\bnotspam\b/gi, keyword: "Notspam", category: "shady" },
        { highlight: /\bnumber 1\b/gi, keyword: "Number 1", category: "shady" },
        { highlight: /\bobligation\b/gi, keyword: "Obligation", category: "shady" },
        { highlight: /\boff\b/gi, keyword: "Off", category: "shady" },
        { highlight: /\boff everything\b/gi, keyword: "Off everything", category: "shady" },
        { highlight: /\boff shore\b/gi, keyword: "Off shore", category: "shady" },
        { highlight: /\boffer extended\b/gi, keyword: "Offer extended", category: "shady" },
        { highlight: /\boffers\b/gi, keyword: "Offers", category: "shady" },
        { highlight: /\boffshore\b/gi, keyword: "Offshore", category: "shady" },
        { highlight: /\bone hundred percent\b/gi, keyword: "One hundred percent", category: "shady" },
        { highlight: /\bone-time\b/gi, keyword: "One-time", category: "shady" },
        { highlight: /\bonline biz opportunity\b/gi, keyword: "Online biz opportunity", category: "shady" },
        { highlight: /\bonline degree\b/gi, keyword: "Online degree", category: "shady" },
        { highlight: /\bonline income\b/gi, keyword: "Online income", category: "shady" },
        { highlight: /\bonline job\b/gi, keyword: "Online job", category: "shady" },
        { highlight: /\bopen\b/gi, keyword: "Open", category: "shady" },
        { highlight: /\bopportunity\b/gi, keyword: "Opportunity", category: "shady" },
        { highlight: /\bopt-in\b/gi, keyword: "Opt-in", category: "shady" },
        { highlight: /\border\b/gi, keyword: "Order", category: "shady" },
        { highlight: /\border shipped by\b/gi, keyword: "Order shipped by", category: "shady" },
        { highlight: /\border status\b/gi, keyword: "Order status", category: "shady" },
        { highlight: /\borders shipped by\b/gi, keyword: "Orders shipped by", category: "shady" },
        { highlight: /\borders shipped by shopper\b/gi, keyword: "Orders shipped by shopper", category: "shady" },
        { highlight: /\boutstanding value\b/gi, keyword: "Outstanding value", category: "shady" },
        { highlight: /\boutstanding values\b/gi, keyword: "Outstanding values", category: "shady" },
        { highlight: /\bpassword\b/gi, keyword: "Password", category: "shady" },
        { highlight: /\bpasswords\b/gi, keyword: "Passwords", category: "shady" },
        { highlight: /\bpay your bills\b/gi, keyword: "Pay your bills", category: "shady" },
        { highlight: /\bper (day|week|year)\b/gi, keyword: "Per day/per week/per year", category: "shady" },
        { highlight: /\bper month\b/gi, keyword: "Per month", category: "shady" },
        { highlight: /\bperfect\b/gi, keyword: "Perfect", category: "shady" },
        { highlight: /\bperformance\b/gi, keyword: "Performance", category: "shady" },
        { highlight: /\bphone\b/gi, keyword: "Phone", category: "shady" },
        { highlight: /\bplease\b/gi, keyword: "Please", category: "shady" },
        { highlight: /\bplease open\b/gi, keyword: "Please open", category: "shady" },
        { highlight: /\bpresently\b/gi, keyword: "Presently", category: "shady" },
        { highlight: /\bprint form signature\b/gi, keyword: "Print form signature", category: "shady" },
        { highlight: /\bprint from signature\b/gi, keyword: "Print from signature", category: "shady" },
        { highlight: /\bprint out and fax\b/gi, keyword: "Print out and fax", category: "shady" },
        { highlight: /\bpriority mail\b/gi, keyword: "Priority mail", category: "shady" },
        { highlight: /\bprivately owned funds\b/gi, keyword: "Privately owned funds", category: "shady" },
        { highlight: /\bprizes\b/gi, keyword: "Prizes", category: "shady" },
        { highlight: /\bproblem with shipping\b/gi, keyword: "Problem with shipping", category: "shady" },
        { highlight: /\bproblem with your order\b/gi, keyword: "Problem with your order", category: "shady" },
        { highlight: /\bproduced and sent out\b/gi, keyword: "Produced and sent out", category: "shady" },
        { highlight: /\bprofit\b/gi, keyword: "Profit", category: "shady" },
        { highlight: /\bpromise you\b/gi, keyword: "Promise you", category: "shady" },
        { highlight: /\bpurchase\b/gi, keyword: "Purchase", category: "shady" },
        { highlight: /\bpure profits\b/gi, keyword: "Pure Profits", category: "shady" },
        { highlight: /\bquotes\b/gi, keyword: "Quotes", category: "shady" },
        { highlight: /\brate\b/gi, keyword: "Rate", category: "shady" },
        { highlight: /\breal thing\b/gi, keyword: "Real thing", category: "shady" },
        { highlight: /\brebate\b/gi, keyword: "Rebate", category: "shady" },
        { highlight: /\breduce debt\b/gi, keyword: "Reduce debt", category: "shady" },
        { highlight: /\brefinance home\b/gi, keyword: "Refinance home", category: "shady" },
        { highlight: /\brefinanced home\b/gi, keyword: "Refinanced home", category: "shady" },
        { highlight: /\brefund\b/gi, keyword: "Refund", category: "shady" },
        { highlight: /\bregarding\b/gi, keyword: "Regarding", category: "shady" },
        { highlight: /\bremoval instructions\b/gi, keyword: "Removal instructions", category: "shady" },
        { highlight: /\bremoves\b/gi, keyword: "Removes", category: "shady" },
        { highlight: /\bremoves wrinkles\b/gi, keyword: "Removes wrinkles", category: "shady" },
        { highlight: /\breplica watches\b/gi, keyword: "Replica watches", category: "shady" },
        { highlight: /\brequest\b/gi, keyword: "Request", category: "shady" },
        { highlight: /\brequest now\b/gi, keyword: "Request now", category: "shady" },
        { highlight: /\brequest today\b/gi, keyword: "Request today", category: "shady" },
        { highlight: /\brequires initial investment\b/gi, keyword: "Requires initial investment", category: "shady" },
        { highlight: /\brequires investment\b/gi, keyword: "Requires investment", category: "shady" },
        { highlight: /\breverses aging\b/gi, keyword: "Reverses aging", category: "shady" },
        { highlight: /\brisk free\b/gi, keyword: "Risk free", category: "shady" },
        { highlight: /\brolex\b/gi, keyword: "Rolex", category: "shady" },
        { highlight: /\bround the world\b/gi, keyword: "Round the world", category: "shady" },
        { highlight: /\bs 1618\b/gi, keyword: "S 1618", category: "shady" },
        { highlight: /\bsafeguard notice\b/gi, keyword: "Safeguard notice", category: "shady" },
        { highlight: /\bsale\b/gi, keyword: "Sale", category: "shady" },
        { highlight: /\bsales\b/gi, keyword: "Sales", category: "shady" },
        { highlight: /\bsave\b/gi, keyword: "Save", category: "shady" },
        { highlight: /\bsave big\b/gi, keyword: "Save big", category: "shady" },
        { highlight: /\bsave big month\b/gi, keyword: "Save big month", category: "shady" },
        { highlight: /\bsave money\b/gi, keyword: "Save money", category: "shady" },
        { highlight: /\bsave now\b/gi, keyword: "Save now", category: "shady" },
        { highlight: /\bscore with babes\b/gi, keyword: "Score with babes", category: "shady" },
        { highlight: /\bsearch engine optimisation\b/gi, keyword: "Search engine optimisation", category: "shady" },
        { highlight: /\bsection 301\b/gi, keyword: "Section 301", category: "shady" },
        { highlight: /\bsee for yourself\b/gi, keyword: "See for yourself", category: "shady" },
        { highlight: /\bseen on\b/gi, keyword: "Seen on", category: "shady" },
        { highlight: /\bserious\b/gi, keyword: "Serious", category: "shady" },
        { highlight: /\bserious case\b/gi, keyword: "Serious case", category: "shady" },
        { highlight: /\bserious offer\b/gi, keyword: "Serious offer", category: "shady" },
        { highlight: /\bserious only\b/gi, keyword: "Serious only", category: "shady" },
        { highlight: /\bsex\b/gi, keyword: "Sex", category: "shady" },
        { highlight: /\bshop now\b/gi, keyword: "Shop now", category: "shady" },
        { highlight: /\bshopper\b/gi, keyword: "Shopper", category: "shady" },
        { highlight: /\bshopping spree\b/gi, keyword: "Shopping spree", category: "shady" },
        { highlight: /\bsnoring\b/gi, keyword: "Snoring", category: "shady" },
        { highlight: /\bsocial security number\b/gi, keyword: "Social security number", category: "shady" },
        { highlight: /\bsoon\b/gi, keyword: "Soon", category: "shady" },
        { highlight: /\bspam\b/gi, keyword: "Spam", category: "shady" },
        { highlight: /\bspam free\b/gi, keyword: "Spam free", category: "shady" },
        { highlight: /\bspecial deal\b/gi, keyword: "Special deal", category: "shady" },
        { highlight: /\bspecial discount\b/gi, keyword: "Special discount", category: "shady" },
        { highlight: /\bspecial for you\b/gi, keyword: "Special for you", category: "shady" },
        { highlight: /\bspecial offer\b/gi, keyword: "Special offer", category: "shady" },
        { highlight: /\bstainless steel\b/gi, keyword: "Stainless steel", category: "shady" },
        { highlight: /\bstock alert\b/gi, keyword: "Stock alert", category: "shady" },
        { highlight: /\bstock disclaimer statement\b/gi, keyword: "Stock disclaimer statement", category: "shady" },
        { highlight: /\bstock pick\b/gi, keyword: "Stock pick", category: "shady" },
        { highlight: /\bstocks? (pick|alert)\b/gi, keyword: "Stocks/stock pick/stock alert", category: "shady" },
        { highlight: /\bstop calling me\b/gi, keyword: "Stop calling me", category: "shady" },
        { highlight: /\bstop emailing me\b/gi, keyword: "Stop emailing me", category: "shady" },
        { highlight: /\bstop further distribution\b/gi, keyword: "Stop further distribution", category: "shady" },
        { highlight: /\bstop snoring\b/gi, keyword: "Stop snoring", category: "shady" },
        { highlight: /\bstrong buy\b/gi, keyword: "Strong buy", category: "shady" },
        { highlight: /\bstuff on sale\b/gi, keyword: "Stuff on sale", category: "shady" },
        { highlight: /\bsubject to\b/gi, keyword: "Subject to", category: "shady" },
        { highlight: /\bsubject to cash\b/gi, keyword: "Subject to cash", category: "shady" },
        { highlight: /\bsubscribe\b/gi, keyword: "Subscribe", category: "shady" },
        { highlight: /\bsubscribe for free\b/gi, keyword: "Subscribe for free", category: "shady" },
        { highlight: /\bsubscribe now\b/gi, keyword: "Subscribe now", category: "shady" },
        { highlight: /\bsuper promo\b/gi, keyword: "Super promo", category: "shady" },
        { highlight: /\bsupplies\b/gi, keyword: "Supplies", category: "shady" },
        { highlight: /\btack action now\b/gi, keyword: "Tack action now", category: "shady" },
        { highlight: /\btalks about hidden charges\b/gi, keyword: "Talks about hidden charges", category: "shady" },
        { highlight: /\btalks about prizes\b/gi, keyword: "Talks about prizes", category: "shady" },
        { highlight: /\btells you it’s an ad\b/gi, keyword: "Tells you it’s an ad", category: "shady" },
        { highlight: /\bterms\b/gi, keyword: "Terms", category: "shady" },
        { highlight: /\bthe best rates\b/gi, keyword: "The best rates", category: "shady" },
        {
          highlight: /\bthe email asks for a credit card\b/gi,
          keyword: "The email asks for a credit card",
          category: "shady",
        },
        { highlight: /\bthe following form\b/gi, keyword: "The following form", category: "shady" },
        {
          highlight: /\bthey make a claim or claims that they're in accordance with spam law\b/gi,
          keyword: "They make a claim or claims that they're in accordance with spam law",
          category: "shady",
        },
        {
          highlight: /\bthey try to keep your money no refund\b/gi,
          keyword: "They try to keep your money no refund",
          category: "shady",
        },
        { highlight: /\bthey’re just giving it away\b/gi, keyword: "They’re just giving it away", category: "shady" },
        { highlight: /\bthis isn't junk\b/gi, keyword: "This isn't junk", category: "shady" },
        { highlight: /\bthis isn't spam\b/gi, keyword: "This isn't spam", category: "shady" },
        { highlight: /\bthis isn’t a scam\b/gi, keyword: "This isn’t a scam", category: "shady" },
        { highlight: /\bthis isn’t junk\b/gi, keyword: "This isn’t junk", category: "shady" },
        { highlight: /\bthis isn’t spam\b/gi, keyword: "This isn’t spam", category: "shady" },
        { highlight: /\btimeshare\b/gi, keyword: "Timeshare", category: "shady" },
        { highlight: /\btimeshare offers\b/gi, keyword: "Timeshare offers", category: "shady" },
        { highlight: /\btraffic\b/gi, keyword: "Traffic", category: "shady" },
        { highlight: /\btrial unlimited\b/gi, keyword: "Trial unlimited", category: "shady" },
        { highlight: /\bu.s. dollars\b/gi, keyword: "U.S. dollars", category: "shady" },
        { highlight: /\bundisclosed\b/gi, keyword: "Undisclosed", category: "shady" },
        { highlight: /\bundisclosed recipient\b/gi, keyword: "Undisclosed recipient", category: "shady" },
        { highlight: /\buniversity diplomas\b/gi, keyword: "University diplomas", category: "shady" },
        { highlight: /\bunsecured credit\b/gi, keyword: "Unsecured credit", category: "shady" },
        { highlight: /\bunsecured debt\b/gi, keyword: "Unsecured debt", category: "shady" },
        { highlight: /\bunsolicited\b/gi, keyword: "Unsolicited", category: "shady" },
        { highlight: /\bunsubscribe\b/gi, keyword: "Unsubscribe", category: "shady" },
        { highlight: /\burgent response\b/gi, keyword: "Urgent response", category: "shady" },
        { highlight: /\bus dollars|euros\b/gi, keyword: "US dollars / Euros", category: "shady" },
        { highlight: /\bvacation\b/gi, keyword: "Vacation", category: "shady" },
        { highlight: /\bvacation offers\b/gi, keyword: "Vacation offers", category: "shady" },
        { highlight: /\bvalium\b/gi, keyword: "Valium", category: "shady" },
        { highlight: /\bviagra\b/gi, keyword: "Viagra", category: "shady" },
        { highlight: /\bvicodin\b/gi, keyword: "Vicodin", category: "shady" },
        { highlight: /\bvip\b/gi, keyword: "VIP", category: "shady" },
        { highlight: /\bvisit our website\b/gi, keyword: "Visit our website", category: "shady" },
        { highlight: /\bwants credit card\b/gi, keyword: "Wants credit card", category: "shady" },
        { highlight: /\bwarranty expired\b/gi, keyword: "Warranty expired", category: "shady" },
        { highlight: /\bwe hate spam\b/gi, keyword: "We hate spam", category: "shady" },
        { highlight: /\bwe honor all\b/gi, keyword: "We honor all", category: "shady" },
        { highlight: /\bwebsite visitors\b/gi, keyword: "Website visitors", category: "shady" },
        { highlight: /\bweekend getaway\b/gi, keyword: "Weekend getaway", category: "shady" },
        { highlight: /\bweight loss\b/gi, keyword: "Weight loss", category: "shady" },
        { highlight: /\bwhat’s keeping you\?\b/gi, keyword: "What’s keeping you?", category: "shady" },
        { highlight: /\bwhile available\b/gi, keyword: "While available", category: "shady" },
        { highlight: /\bwhile in stock\b/gi, keyword: "While in stock", category: "shady" },
        { highlight: /\bwhile stocks last\b/gi, keyword: "While stocks last", category: "shady" },
        { highlight: /\bwhile you sleep\b/gi, keyword: "While you sleep", category: "shady" },
        { highlight: /\bwho really wins\?\b/gi, keyword: "Who really wins?", category: "shady" },
        { highlight: /\bwin\b/gi, keyword: "Win", category: "shady" },
        { highlight: /\bwinner\b/gi, keyword: "Winner", category: "shady" },
        { highlight: /\bwinning\b/gi, keyword: "Winning", category: "shady" },
        { highlight: /\bwon\b/gi, keyword: "Won", category: "shady" },
        { highlight: /\bxanax\b/gi, keyword: "Xanax", category: "shady" },
        { highlight: /\bxxx\b/gi, keyword: "XXX", category: "shady" },
        { highlight: /\byou have been chosen\b/gi, keyword: "You have been chosen", category: "shady" },
        { highlight: /\byou have been selected\b/gi, keyword: "You have been selected", category: "shady" },
        { highlight: /\byour chance\b/gi, keyword: "Your chance", category: "shady" },
        { highlight: /\byour status\b/gi, keyword: "Your status", category: "shady" },
        { highlight: /\bzero chance\b/gi, keyword: "Zero chance", category: "shady" },
        { highlight: /\bzero percent\b/gi, keyword: "Zero percent", category: "shady" },
        { highlight: /\bzero risk\b/gi, keyword: "Zero risk", category: "shady" },
        { highlight: /\b#1\b/gi, keyword: "#1", category: "overpromise" },
        { highlight: /[0-9]+%/gi, keyword: "%", category: "overpromise" },
        { highlight: /[0-9]+% free/gi, keyword: "% free", category: "overpromise" },
        { highlight: /\b[0-9]+% satisfied\b/gi, keyword: "% Satisfied", category: "overpromise" },
        { highlight: /\b[0-9]+%\b/gi, keyword: "0%", category: "overpromise" },
        { highlight: /\b[0-9]+% risk\b/gi, keyword: "0% risk", category: "overpromise" },
        { highlight: /\b100%\b/gi, keyword: "100%", category: "overpromise" },
        { highlight: /\b100% free\b/gi, keyword: "100% free", category: "overpromise" },
        { highlight: /\b100% more\b/gi, keyword: "100% more", category: "overpromise" },
        { highlight: /\b100% off\b/gi, keyword: "100% off", category: "overpromise" },
        { highlight: /\b100% satisfied\b/gi, keyword: "100% satisfied", category: "overpromise" },
        { highlight: /\b99.90%\b/gi, keyword: "99.90%", category: "overpromise" },
        { highlight: /\b99%\b/gi, keyword: "99%", category: "overpromise" },
        { highlight: /\baccess for free\b/gi, keyword: "Access for free", category: "overpromise" },
        { highlight: /\badditional income\b/gi, keyword: "Additional income", category: "overpromise" },
        { highlight: /\bamazed\b/gi, keyword: "Amazed", category: "overpromise" },
        { highlight: /\bamazing\b/gi, keyword: "Amazing", category: "overpromise" },
        { highlight: /\bamazing offer\b/gi, keyword: "Amazing offer", category: "overpromise" },
        { highlight: /\bamazing stuff\b/gi, keyword: "Amazing stuff", category: "overpromise" },
        { highlight: /\bbe amazed\b/gi, keyword: "Be amazed", category: "overpromise" },
        { highlight: /\bbe surprised\b/gi, keyword: "Be surprised", category: "overpromise" },
        { highlight: /\bbe your own boss\b/gi, keyword: "Be your own boss", category: "overpromise" },
        { highlight: /\bbelieve me\b/gi, keyword: "Believe me", category: "overpromise" },
        { highlight: /\bbest bargain\b/gi, keyword: "Best bargain", category: "overpromise" },
        { highlight: /\bbest deal\b/gi, keyword: "Best deal", category: "overpromise" },
        { highlight: /\bbest offer\b/gi, keyword: "Best offer", category: "overpromise" },
        { highlight: /\bbest price\b/gi, keyword: "Best price", category: "overpromise" },
        { highlight: /\bbest rates\b/gi, keyword: "Best rates", category: "overpromise" },
        { highlight: /\bbig bucks\b/gi, keyword: "Big bucks", category: "overpromise" },
        { highlight: /\bbonus\b/gi, keyword: "Bonus", category: "overpromise" },
        { highlight: /\bboss\b/gi, keyword: "Boss", category: "overpromise" },
        { highlight: /\bcan’t live without\b/gi, keyword: "Can’t live without", category: "overpromise" },
        { highlight: /\bcancel\b/gi, keyword: "Cancel", category: "overpromise" },
        { highlight: /\bconsolidate debt\b/gi, keyword: "Consolidate debt", category: "overpromise" },
        { highlight: /\bdouble your cash\b/gi, keyword: "Double your cash", category: "overpromise" },
        { highlight: /\bdouble your income\b/gi, keyword: "Double your income", category: "overpromise" },
        { highlight: /\bdrastically reduced\b/gi, keyword: "Drastically reduced", category: "overpromise" },
        { highlight: /\bearn extra cash\b/gi, keyword: "Earn extra cash", category: "overpromise" },
        { highlight: /\bearn money\b/gi, keyword: "Earn money", category: "overpromise" },
        { highlight: /\beliminate bad credit\b/gi, keyword: "Eliminate bad credit", category: "overpromise" },
        { highlight: /\bexpect to earn\b/gi, keyword: "Expect to earn", category: "overpromise" },
        { highlight: /\bextra\b/gi, keyword: "Extra", category: "overpromise" },
        { highlight: /\bextra cash\b/gi, keyword: "Extra cash", category: "overpromise" },
        { highlight: /\bextra income\b/gi, keyword: "Extra income", category: "overpromise" },
        { highlight: /\bfantastic\b/gi, keyword: "Fantastic", category: "overpromise" },
        { highlight: /\bfantastic deal\b/gi, keyword: "Fantastic deal", category: "overpromise" },
        { highlight: /\bfantastic offer\b/gi, keyword: "Fantastic offer", category: "overpromise" },
        { highlight: /\bfast\b/gi, keyword: "FAST", category: "overpromise" },
        { highlight: /\bfast cash\b/gi, keyword: "Fast cash", category: "overpromise" },
        { highlight: /\bfinancial freedom\b/gi, keyword: "Financial freedom", category: "overpromise" },
        { highlight: /\bfree access\b/gi, keyword: "Free access", category: "overpromise" },
        { highlight: /\bfree consultation\b/gi, keyword: "Free consultation", category: "overpromise" },
        { highlight: /\bfree gift\b/gi, keyword: "Free gift", category: "overpromise" },
        { highlight: /\bfree hosting\b/gi, keyword: "Free hosting", category: "overpromise" },
        { highlight: /\bfree info\b/gi, keyword: "Free info", category: "overpromise" },
        { highlight: /\bfree investment\b/gi, keyword: "Free investment", category: "overpromise" },
        { highlight: /\bfree membership\b/gi, keyword: "Free membership", category: "overpromise" },
        { highlight: /\bfree money\b/gi, keyword: "Free money", category: "overpromise" },
        { highlight: /\bfree preview\b/gi, keyword: "Free preview", category: "overpromise" },
        { highlight: /\bfree quote\b/gi, keyword: "Free quote", category: "overpromise" },
        { highlight: /\bfree trial\b/gi, keyword: "Free trial", category: "overpromise" },
        { highlight: /\bfull refund\b/gi, keyword: "Full refund", category: "overpromise" },
        { highlight: /\bget out of debt\b/gi, keyword: "Get out of debt", category: "overpromise" },
        { highlight: /\bgiveaway\b/gi, keyword: "Giveaway", category: "overpromise" },
        { highlight: /\bguaranteed\b/gi, keyword: "Guaranteed", category: "overpromise" },
        { highlight: /\bincrease sales\b/gi, keyword: "Increase sales", category: "overpromise" },
        { highlight: /\bincrease traffic\b/gi, keyword: "Increase traffic", category: "overpromise" },
        { highlight: /\bincredible deal\b/gi, keyword: "Incredible deal", category: "overpromise" },
        { highlight: /\bjoin billions\b/gi, keyword: "Join billions", category: "overpromise" },
        { highlight: /\bjoin millions\b/gi, keyword: "Join millions", category: "overpromise" },
        {
          highlight: /\bjoin millions of americans\b/gi,
          keyword: "Join millions of Americans",
          category: "overpromise",
        },
        { highlight: /\bjoin thousands\b/gi, keyword: "Join thousands", category: "overpromise" },
        { highlight: /\blower rates\b/gi, keyword: "Lower rates", category: "overpromise" },
        { highlight: /\blowest price\b/gi, keyword: "Lowest price", category: "overpromise" },
        { highlight: /\bmake money\b/gi, keyword: "Make money", category: "overpromise" },
        { highlight: /\bmillion\b/gi, keyword: "Million", category: "overpromise" },
        { highlight: /\bmillion dollars\b/gi, keyword: "Million dollars", category: "overpromise" },
        { highlight: /\bmiracle\b/gi, keyword: "Miracle", category: "overpromise" },
        { highlight: /\bmoney back\b/gi, keyword: "Money back", category: "overpromise" },
        { highlight: /\bmonth trial offer\b/gi, keyword: "Month trial offer", category: "overpromise" },
        { highlight: /\bmore internet traffic\b/gi, keyword: "More Internet Traffic", category: "overpromise" },
        { highlight: /\bnumber one\b/gi, keyword: "Number one", category: "overpromise" },
        { highlight: /\bonce in a lifetime\b/gi, keyword: "Once in a lifetime", category: "overpromise" },
        {
          highlight: /\bone hundred percent guaranteed\b/gi,
          keyword: "One hundred percent guaranteed",
          category: "overpromise",
        },
        { highlight: /\bone time\b/gi, keyword: "One time", category: "overpromise" },
        { highlight: /\bpennies a day\b/gi, keyword: "Pennies a day", category: "overpromise" },
        { highlight: /\bpotential earnings\b/gi, keyword: "Potential earnings", category: "overpromise" },
        { highlight: /\bprize\b/gi, keyword: "Prize", category: "overpromise" },
        { highlight: /\bpromise\b/gi, keyword: "Promise", category: "overpromise" },
        { highlight: /\bpure profit\b/gi, keyword: "Pure profit", category: "overpromise" },
        { highlight: /\brisk-free\b/gi, keyword: "Risk-free", category: "overpromise" },
        { highlight: /\bsatisfaction guaranteed\b/gi, keyword: "Satisfaction guaranteed", category: "overpromise" },
        { highlight: /\bsave big money\b/gi, keyword: "Save big money", category: "overpromise" },
        { highlight: /\bsave up to\b/gi, keyword: "Save up to", category: "overpromise" },
        { highlight: /\bspecial promotion\b/gi, keyword: "Special promotion", category: "overpromise" },
        { highlight: /\bthe best\b/gi, keyword: "The best", category: "overpromise" },
        { highlight: /\bthousands\b/gi, keyword: "Thousands", category: "overpromise" },
        { highlight: /\bunbeatable offer\b/gi, keyword: "Unbeatable offer", category: "overpromise" },
        { highlight: /\bunbelievable\b/gi, keyword: "Unbelievable", category: "overpromise" },
        { highlight: /\bunlimited\b/gi, keyword: "Unlimited", category: "overpromise" },
        { highlight: /\bunlimited trial\b/gi, keyword: "Unlimited trial", category: "overpromise" },
        { highlight: /\bwonderful\b/gi, keyword: "Wonderful", category: "overpromise" },
        {
          highlight: /\byou will not believe your eyes\b/gi,
          keyword: "You will not believe your eyes",
          category: "overpromise",
        },
        { highlight: /[\$£€¥]+[0-9\.\,]+/gi, keyword: "$$$", category: "money" },
        { highlight: /[0-9\.\,]+[\$£€¥]+/gi, keyword: "€€€", category: "money" },
        { highlight: /[\$£€¥]{2,}/gi, keyword: "£££", category: "money" },
        { highlight: /\b[0-9\.,]+%( off)?\b/gi, keyword: "50% off", category: "money" },
        { highlight: /\ba few bob\b/gi, keyword: "A few bob", category: "money" },
        { highlight: /\baccept cash cards\b/gi, keyword: "Accept cash cards", category: "money" },
        { highlight: /\baccept credit cards\b/gi, keyword: "Accept credit cards", category: "money" },
        { highlight: /\baffordable\b/gi, keyword: "Affordable", category: "money" },
        { highlight: /\baffordable deal\b/gi, keyword: "Affordable deal", category: "money" },
        { highlight: /\bavoid bankruptcy\b/gi, keyword: "Avoid bankruptcy", category: "money" },
        { highlight: /\bbad credit\b/gi, keyword: "Bad credit", category: "money" },
        { highlight: /\bbank\b/gi, keyword: "Bank", category: "money" },
        { highlight: /\bbankruptcy\b/gi, keyword: "Bankruptcy", category: "money" },
        { highlight: /\bbargain\b/gi, keyword: "Bargain", category: "money" },
        { highlight: /\bbilling\b/gi, keyword: "Billing", category: "money" },
        { highlight: /\bbilling address\b/gi, keyword: "Billing address", category: "money" },
        { highlight: /\bbillion\b/gi, keyword: "Billion", category: "money" },
        { highlight: /\bbillion dollars\b/gi, keyword: "Billion dollars", category: "money" },
        { highlight: /\bbillionaire\b/gi, keyword: "Billionaire", category: "money" },
        { highlight: /\bcard accepted\b/gi, keyword: "Card accepted", category: "money" },
        { highlight: /\bcards accepted\b/gi, keyword: "Cards accepted", category: "money" },
        { highlight: /\bcash\b/gi, keyword: "Cash", category: "money" },
        { highlight: /\bcash bonus\b/gi, keyword: "Cash bonus", category: "money" },
        { highlight: /\bcash out\b/gi, keyword: "Cash out", category: "money" },
        { highlight: /\bcash-out\b/gi, keyword: "Cash-out", category: "money" },
        { highlight: /\bcashcashcash\b/gi, keyword: "Cashcashcash", category: "money" },
        { highlight: /\bcasino\b/gi, keyword: "Casino", category: "money" },
        { highlight: /\bcents on the dollar\b/gi, keyword: "Cents on the dollar", category: "money" },
        { highlight: /\bcheck\b/gi, keyword: "Check", category: "money" },
        { highlight: /\bcheck or money order\b/gi, keyword: "Check or money order", category: "money" },
        { highlight: /\bclaim your discount\b/gi, keyword: "Claim your discount", category: "money" },
        { highlight: /\bcost\b/gi, keyword: "Cost", category: "money" },
        { highlight: /\bcosts\b/gi, keyword: "Costs", category: "money" },
        { highlight: /\bcredit\b/gi, keyword: "Credit", category: "money" },
        { highlight: /\bcredit bureaus\b/gi, keyword: "Credit bureaus", category: "money" },
        { highlight: /\bcredit card\b/gi, keyword: "Credit card", category: "money" },
        { highlight: /\bcredit card offers\b/gi, keyword: "Credit card offers", category: "money" },
        { highlight: /\bcredit or debit\b/gi, keyword: "Credit or Debit", category: "money" },
        { highlight: /\bdeal\b/gi, keyword: "Deal", category: "money" },
        { highlight: /\bdebt\b/gi, keyword: "Debt", category: "money" },
        { highlight: /\bdiscount\b/gi, keyword: "Discount", category: "money" },
        { highlight: /\bdollars\b/gi, keyword: "Dollars", category: "money" },
        { highlight: /\bdouble your\b/gi, keyword: "Double your", category: "money" },
        { highlight: /\bdouble your wealth\b/gi, keyword: "Double your wealth", category: "money" },
        { highlight: /\bearn\b/gi, keyword: "Earn", category: "money" },
        { highlight: /\bearn [\$£€¥]+\b/gi, keyword: "Earn $", category: "money" },
        { highlight: /\bearn cash\b/gi, keyword: "Earn cash", category: "money" },
        { highlight: /\bearn extra income\b/gi, keyword: "Earn extra income", category: "money" },
        { highlight: /\bearn from home\b/gi, keyword: "Earn from home", category: "money" },
        { highlight: /\bearn monthly\b/gi, keyword: "Earn monthly", category: "money" },
        { highlight: /\bearn per month\b/gi, keyword: "Earn per month", category: "money" },
        { highlight: /\bearn per week\b/gi, keyword: "Earn per week", category: "money" },
        { highlight: /\bearn your degree\b/gi, keyword: "Earn your degree", category: "money" },
        { highlight: /\beasy income\b/gi, keyword: "Easy income", category: "money" },
        { highlight: /\beasy terms\b/gi, keyword: "Easy terms", category: "money" },
        { highlight: /\bf r e e\b/gi, keyword: "F r e e", category: "money" },
        { highlight: /\bfor free\b/gi, keyword: "For free", category: "money" },
        { highlight: /\bfor just [\$£€¥]+\b/gi, keyword: "For just $", category: "money" },
        { highlight: /\bfor just [\$£€¥]+[0-9]+\b/gi, keyword: "For just $ (amount)", category: "money" },
        { highlight: /\bfor just [\$£€¥]+xxx\b/gi, keyword: "For just $xxx", category: "money" },
        { highlight: /\bget money\b/gi, keyword: "Get Money", category: "money" },
        { highlight: /\bget your money\b/gi, keyword: "Get your money", category: "money" },
        { highlight: /\bhidden assets\b/gi, keyword: "Hidden assets", category: "money" },
        { highlight: /\bhuge discount\b/gi, keyword: "Huge discount", category: "money" },
        { highlight: /\bincome\b/gi, keyword: "Income", category: "money" },
        { highlight: /\bincome from home\b/gi, keyword: "Income from home", category: "money" },
        { highlight: /\bincrease revenue\b/gi, keyword: "Increase revenue", category: "money" },
        { highlight: /\bincrease (sales|traffic)\b/gi, keyword: "Increase sales/traffic", category: "money" },
        { highlight: /\bincrease your chances\b/gi, keyword: "Increase your chances", category: "money" },
        { highlight: /\binitial investment\b/gi, keyword: "Initial investment", category: "money" },
        { highlight: /\binstant earnings\b/gi, keyword: "Instant earnings", category: "money" },
        { highlight: /\binstant income\b/gi, keyword: "Instant income", category: "money" },
        { highlight: /\binsurance\b/gi, keyword: "Insurance", category: "money" },
        { highlight: /\binvestment\b/gi, keyword: "Investment", category: "money" },
        { highlight: /\binvestment advice\b/gi, keyword: "Investment advice", category: "money" },
        { highlight: /\blifetime\b/gi, keyword: "Lifetime", category: "money" },
        { highlight: /\bloans\b/gi, keyword: "Loans", category: "money" },
        { highlight: /\bmake [\$£€¥]+\b/gi, keyword: "Make $", category: "money" },
        { highlight: /\bmoney\b/gi, keyword: "Money", category: "money" },
        { highlight: /\bmoney making\b/gi, keyword: "Money making", category: "money" },
        { highlight: /\bmoney-back guarantee\b/gi, keyword: "Money-back guarantee", category: "money" },
        { highlight: /\bmoney-making\b/gi, keyword: "Money-making", category: "money" },
        { highlight: /\bmonthly payment\b/gi, keyword: "Monthly payment", category: "money" },
        { highlight: /\bmortgage\b/gi, keyword: "Mortgage", category: "money" },
        { highlight: /\bmortgage rates\b/gi, keyword: "Mortgage rates", category: "money" },
        { highlight: /\boffer\b/gi, keyword: "Offer", category: "money" },
        { highlight: /\bone hundred percent free\b/gi, keyword: "One hundred percent free", category: "money" },
        { highlight: /\bonly [\$£€¥]+\b/gi, keyword: "Only $", category: "money" },
        { highlight: /\bprice\b/gi, keyword: "Price", category: "money" },
        { highlight: /\bprice protection\b/gi, keyword: "Price protection", category: "money" },
        { highlight: /\bprices\b/gi, keyword: "Prices", category: "money" },
        { highlight: /\bprofits\b/gi, keyword: "Profits", category: "money" },
        { highlight: /\bquote\b/gi, keyword: "Quote", category: "money" },
        { highlight: /\brates\b/gi, keyword: "Rates", category: "money" },
        { highlight: /\brefinance\b/gi, keyword: "Refinance", category: "money" },
        { highlight: /\bsave [\$£€¥]+\b/gi, keyword: "Save $", category: "money" },
        { highlight: /\bserious cash\b/gi, keyword: "Serious cash", category: "money" },
        { highlight: /\bsubject to credit\b/gi, keyword: "Subject to credit", category: "money" },
        { highlight: /\bus dollars\b/gi, keyword: "US dollars", category: "money" },
        { highlight: /\bwhy pay more\?\b/gi, keyword: "Why pay more?", category: "money" },
        { highlight: /\byour income\b/gi, keyword: "Your income", category: "money" },
        { highlight: /\bacceptance\b/gi, keyword: "Acceptance", category: "unnatural" },
        { highlight: /\baccordingly\b/gi, keyword: "Accordingly", category: "unnatural" },
        {
          highlight: /\baccount-based marketing (abm)\b/gi,
          keyword: "Account-based marketing (ABM)",
          category: "unnatural",
        },
        { highlight: /\baccounts\b/gi, keyword: "Accounts", category: "unnatural" },
        { highlight: /\baddresses\b/gi, keyword: "Addresses", category: "unnatural" },
        { highlight: /\baddresses on cd\b/gi, keyword: "Addresses on CD", category: "unnatural" },
        { highlight: /\bbeverage\b/gi, keyword: "Beverage", category: "unnatural" },
        {
          highlight: /\bconfidentiality on all orders\b/gi,
          keyword: "Confidentiality on all orders",
          category: "unnatural",
        },
        {
          highlight: /\bconfidentially on all orders\b/gi,
          keyword: "Confidentially on all orders",
          category: "unnatural",
        },
        { highlight: /\bcontent marketing\b/gi, keyword: "Content marketing", category: "unnatural" },
        { highlight: /\bdear(est)? (.+@.+)\b/gi, keyword: "Dear [email address]", category: "unnatural" },
        {
          highlight: /\bdear(est)? (email|friend|somebody)\b/gi,
          keyword: "Dear [email/friend/somebody]",
          category: "unnatural",
        },
        { highlight: /\bdear [first name]\b/gi, keyword: "Dear [first name]", category: "unnatural" },
        { highlight: /\bdear [wrong name]\b/gi, keyword: "Dear [wrong name]", category: "unnatural" },
        { highlight: /\bdigital marketing\b/gi, keyword: "Digital marketing", category: "unnatural" },
        { highlight: /\bdormant\b/gi, keyword: "Dormant", category: "unnatural" },
        { highlight: /\bemail extractor\b/gi, keyword: "Email extractor", category: "unnatural" },
        { highlight: /\bemail harvest\b/gi, keyword: "Email harvest", category: "unnatural" },
        { highlight: /\bemail marketing\b/gi, keyword: "Email marketing", category: "unnatural" },
        { highlight: /\bextract email\b/gi, keyword: "Extract email", category: "unnatural" },
        { highlight: /\bform\b/gi, keyword: "Form", category: "unnatural" },
        { highlight: /\bfreedom\b/gi, keyword: "Freedom", category: "unnatural" },
        { highlight: /\bfriend\b/gi, keyword: "Friend", category: "unnatural" },
        { highlight: /\bhere\b/gi, keyword: "Here", category: "unnatural" },
        { highlight: /\bhidden\b/gi, keyword: "Hidden", category: "unnatural" },
        { highlight: /\bhome\b/gi, keyword: "Home", category: "unnatural" },
        { highlight: /\bhome based\b/gi, keyword: "Home based", category: "unnatural" },
        { highlight: /\bhome employment\b/gi, keyword: "Home employment", category: "unnatural" },
        { highlight: /\bhome-based\b/gi, keyword: "Home-based", category: "unnatural" },
        { highlight: /\bhome-based business\b/gi, keyword: "Home-based business", category: "unnatural" },
        { highlight: /\bhomebased business\b/gi, keyword: "Homebased business", category: "unnatural" },
        {
          highlight: /\bif you no longer wish to receive\b/gi,
          keyword: "If you no longer wish to receive",
          category: "unnatural",
        },
        {
          highlight: /\bimportant information regarding\b/gi,
          keyword: "Important information regarding",
          category: "unnatural",
        },
        { highlight: /\bin accordance with laws\b/gi, keyword: "In accordance with laws", category: "unnatural" },
        { highlight: /\bincrease your sales\b/gi, keyword: "Increase your sales", category: "unnatural" },
        { highlight: /\binternet market\b/gi, keyword: "Internet market", category: "unnatural" },
        { highlight: /\bleave\b/gi, keyword: "Leave", category: "unnatural" },
        { highlight: /\blose\b/gi, keyword: "Lose", category: "unnatural" },
        { highlight: /\bmaintained\b/gi, keyword: "Maintained", category: "unnatural" },
        { highlight: /\bmarketing\b/gi, keyword: "Marketing", category: "unnatural" },
        { highlight: /\bmarketing solution\b/gi, keyword: "Marketing solution", category: "unnatural" },
        { highlight: /\bmarketing solutions\b/gi, keyword: "Marketing solutions", category: "unnatural" },
        { highlight: /\bmedium\b/gi, keyword: "Medium", category: "unnatural" },
        { highlight: /\bmessage contains\b/gi, keyword: "Message contains", category: "unnatural" },
        { highlight: /\bmulti level marketing\b/gi, keyword: "Multi level marketing", category: "unnatural" },
        { highlight: /\bnever\b/gi, keyword: "Never", category: "unnatural" },
        { highlight: /\bone time mailing\b/gi, keyword: "One time mailing", category: "unnatural" },
        { highlight: /\bonline marketing\b/gi, keyword: "Online marketing", category: "unnatural" },
        { highlight: /\bonline pharmacy\b/gi, keyword: "Online pharmacy", category: "unnatural" },
        { highlight: /\bopt in\b/gi, keyword: "Opt in", category: "unnatural" },
        { highlight: /\bper day\b/gi, keyword: "Per day", category: "unnatural" },
        { highlight: /\bper week\b/gi, keyword: "Per week", category: "unnatural" },
        { highlight: /\bpre-approved\b/gi, keyword: "Pre-approved", category: "unnatural" },
        { highlight: /\bproblem\b/gi, keyword: "Problem", category: "unnatural" },
        { highlight: /\bremoval\b/gi, keyword: "Removal", category: "unnatural" },
        { highlight: /\bremove\b/gi, keyword: "Remove", category: "unnatural" },
        { highlight: /\breserves the right\b/gi, keyword: "Reserves the right", category: "unnatural" },
        { highlight: /\breverses\b/gi, keyword: "Reverses", category: "unnatural" },
        { highlight: /\bsample\b/gi, keyword: "Sample", category: "unnatural" },
        { highlight: /\bsatisfaction\b/gi, keyword: "Satisfaction", category: "unnatural" },
        { highlight: /\bscore\b/gi, keyword: "Score", category: "unnatural" },
        { highlight: /\bsearch engine\b/gi, keyword: "Search engine", category: "unnatural" },
        { highlight: /\bsearch engine listings\b/gi, keyword: "Search engine listings", category: "unnatural" },
        { highlight: /\bsearch engines\b/gi, keyword: "Search engines", category: "unnatural" },
        { highlight: /\bsent in compliance\b/gi, keyword: "Sent in compliance", category: "unnatural" },
        { highlight: /\bsolution\b/gi, keyword: "Solution", category: "unnatural" },
        { highlight: /\bstop\b/gi, keyword: "Stop", category: "unnatural" },
        { highlight: /\bsuccess\b/gi, keyword: "Success", category: "unnatural" },
        { highlight: /\bteen\b/gi, keyword: "Teen", category: "unnatural" },
        { highlight: /\bterms and conditions\b/gi, keyword: "Terms and conditions", category: "unnatural" },
        { highlight: /\bwarranty\b/gi, keyword: "Warranty", category: "unnatural" },
        { highlight: /\bweb traffic\b/gi, keyword: "Web traffic", category: "unnatural" },
        { highlight: /\bwife\b/gi, keyword: "Wife", category: "unnatural" },
        { highlight: /\bwork at home\b/gi, keyword: "Work at home", category: "unnatural" },
        { highlight: /\bwork from home\b/gi, keyword: "Work from home", category: "unnatural" },
      ],
    });
  });
})(jQuery);
