$(function () {
    // Data
    // var colors = ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"];
    // var colors = ["#a50026","#f46d43","#fee090","#e0f3f8","#74add1","#313695"];
    var colors = ["#fccde5", "#ffffb3", "lightblue", "#fb8072", "#fdb462", "#bebada", "#b3de69", "#d9d9d9", "#bc80bd", "#ccebc5", "#8dd3c7", "#ffed6f", "#80b1d3"];
    // var dataset = "mc1data"; // cialeakcase, citations, inception, minich1newsart, minich1emails, mc1data
    var dataset = "facebookUNC"; // cialeakcase, citations, inception, minich1newsart, minich1emails, mc1data
    //var dataset =  'cialeakcase'; //citations, inception, minich1newsart, minich1emails, mc1data

    //new data push
    let newArray = [];

    let loadData = function () {

        let query = getUrlQueryByName('url');

        let publicSpreadsheetUrl = query || window.sessionStorage.getItem("timesetDataSheet");
        let googleSheetName;

        function init_table() {
            Tabletop.init({
                key: publicSpreadsheetUrl,
                callback: consume_table,
                simpleSheet: false
            });
        }
        function consume_table(data, tabletop) {
            googleSheetName = tabletop.googleSheetName;
            let newdata = data.data.elements;
            init(newdata);

            //hide loader
            if (document.getElementById("loading")) {
                document.getElementById("loading").style.display = "none"
            }
        }
        function init(d) {
            var format = d3.time.format("%Y-%m-%dT%H:%M:%S+0000");

            data = d;
            data.forEach(function (d) {

                d.SourceType = "Article";

                d.Content = d.name || d.description;

                if (d.description === "" || " ") {
                    d.Content = d.message;
                }
                d.from = d.from;
                d.Subject = d.name;
                d.Trust = "C3";
                d.Relevance = 4;
                if (d.created_time) {
                    d.time = format.parse(d.created_time)
                } else {
                    d.time = format.parse("2016-09-19T03:00:51+0000")
                }

                //rating conversion from string to values
                d.Rating = sm.convertRating(d.Rating);
                // rating setup
                // console.log(d);
            });
            // Convert to TimeSets format
            formatFacebookUNCData();

            // Create the trust filter.
            var trustFilter = sm.misc.trustFilter()
                .on("trustfilterchanged", function (trustFilter) {
                    timesets.trustFilter(trustFilter);
                    timesets.update(null, false);
                });
            trustFilter();

            timesets.trustFilter(trustFilter.filter());

            updateVis();
        }
        if (query) {
            documentReady(function () {
                init_table();
            });
        } else {
            var format = d3.time.format("%Y-%m-%dT%H:%M:%S+0000");
            d3.json("data/fbv3.json", function (d) {

                //hide loader
                if (document.getElementById("loading")) {
                    document.getElementById("loading").style.display = "none"
                }

                data = d;
                data.forEach(function (d) {

                    d.SourceType = "Article";

                    d.Content = d.name || d.description;

                    if (d.description === "" || " ") {
                        d.Content = d.message;
                    }
                    d.from = d.from.name;
                    d.Subject = d.name;
                    d.Trust = "C3";
                    d.Relevance = 4;
                    if (d.created_time) {
                        d.time = format.parse(d.created_time)
                    } else {
                        d.time = format.parse("2016-09-19T03:00:51+0000")
                    }

                    //rating conversion from string to values
                    d.Rating = sm.convertRating(d.Rating);
                    // rating setup
                    // console.log(d);
                });

                // Convert to TimeSets format
                formatFacebookUNCData();

                // Create the trust filter.
                var trustFilter = sm.misc.trustFilter()
                    .on("trustfilterchanged", function (trustFilter) {
                        timesets.trustFilter(trustFilter);
                        timesets.update(null, false);
                    });
                trustFilter();

                timesets.trustFilter(trustFilter.filter());

                updateVis();
            });
        }
    };
    $(".sidebar-resizer").bind("click", function () {
        var aside = $("aside");
        aside.toggle();

        if (aside.css("display") === "none") {
            $(".sidebar-resizer").css("left", "0px");
        }
        else {
            $(".sidebar-resizer").css("left", aside.width());
        }
    });

    loadData();

    // Instantiate vis
    var timesets = sm.vis.timesets()
        .colors(colors)
        // .setMode("background")
        // .applyLayout(false)
        .verticalMode("ellipse")
        .elementMode("circles")
        .showSettings(false)
        .margin({top: -15, right: 85, bottom: -20, left: 25});

    // Update the vis
    var updateVis = function () {
        // Update dimension
        var FOOTER_BORDER_SIZE = 0;
        var FUDGE_FIGURE = 7; // something to do with a timesets svg group transform

        var middle = $(".middle");
        middle.height(window.innerHeight - middle.position().top - $("footer").height() - FUDGE_FIGURE - FOOTER_BORDER_SIZE);
        var width = window.innerWidth;
        var height = middle.height();

        // prevent oversized height
        $("svg").height(height);
        $("svg").width(width);
        timesets.width(width).height(height - 30);
        d3.select(".sm-timesets-demo").attr("transform", "translate(0, " + (height) + ")");

        redraw();

        var resizer = $(".sidebar-resizer");
        var aside = $("aside");
        resizer
            .css("top", (aside.height() - resizer.height()) / 2)
            .css("left", aside.width());

        $("body").css("visibility", "visible");
    };

    // Add a listener to the window to show the settings
    $("body").on("keyup", function (e) {
        switch (e.which || e.keyCode) {
            case 83:
            case 115:
                if (e.altKey) {
                    timesets.showSettings(true);
                }
                break;
        }
    });

    // Rebuild vis when the window is resized
    // Not draw properly with TimeSets
    // var id;
    // $(window).resize(function() {
    //     clearTimeout(id);
    //     id = setTimeout(updateVis, 100);
    // });

    /**
     * Redraws the visualization.
     */
    function redraw() {
        d3.select(".sm-timesets-demo").datum(data).call(timesets);
    }

    function formatCitations() {
        var mapPaper = function (p) {
            return {id: p.id, themes: p.concepts, time: new Date(+p.year, 0, 1), title: p.title};
        };

        // Option 1: Use articles for the last N years with the top N articles in each year
        // var n = 15;
        // data = data.slice(data.length - n);
        var papers = [];
        var conceptLookup = {};

        // data.forEach(function(d) { // each is a year
        //     // Sort by most citations
        //     d.papers.sort(function(a, b) { return d3.descending(+a.gscholar, +b.gscholar) });

        //     for (var i = 0; i < n; i++) {
        //         // To count concept frequency
        //         var p = d.papers[i];
        //         p.concepts.forEach(function(c) {
        //             if (!conceptLookup[c]) conceptLookup[c] = 0;
        //             conceptLookup[c]++;
        //         });

        //         papers.push(mapPaper(p));
        //     }
        // });

        // Option 2: top N articles with highest citations
        // Flatten to get all papers
        var n = 200;
        data = data.map(function (d) {
            return d.papers;
        }).reduce(function (a, b) {
            return a.concat(b);
        });
        data = data.sort(function (a, b) {
            return d3.descending(+a.gscholar, +b.gscholar);
        }).slice(0, n);
        var yearCount = {}; // Count articles by year
        data.forEach(function (d) {
            // To count concept frequency
            d.concepts.forEach(function (c) {
                if (!conceptLookup[c]) conceptLookup[c] = 0;
                conceptLookup[c]++;

            });

            if (!yearCount[d.year]) yearCount[d.year] = 0;
            yearCount[d.year]++;

            papers.push(mapPaper(d));
        });

        // Show histogram by year
        var yearPubs = d3.entries(yearCount).sort(function (a, b) {
            return d3.descending(+a.value, +b.value);
        });
        console.log(yearPubs);

        // There are many concepts, only show top N
        n = 8;
        var concepts = d3.entries(conceptLookup);
        concepts.sort(function (a, b) {
            return d3.descending(a.value, b.value);
        });
        var themes = concepts.slice(0, n).map(function (d) {
            return d.key;
        });

        papers.forEach(function (d) {
            d.themes = d.themes.filter(function (t) {
                return themes.indexOf(t) !== -1;
            });
        });

        data = {themes: themes, events: papers};
    }

    function formatMovie(text) {
        var rows = text.split("\n");
        var startingDataRow = 7;
        var numRowsPerEvent = 7;
        var numEvents = (rows.length - startingDataRow - 1) / numRowsPerEvent;
        var events = [];
        var themes = [];

        // Extract data
        for (var i = 0; i < numEvents; i++) {
            var j = startingDataRow + numRowsPerEvent * i;
            var e = {
                title: "Interaction " + rows[j].split(":")[1].trim(),
                id: +rows[j + 1].split(":")[1],
                time: +rows[j + 2].split(":")[1],
                endTime: +rows[j + 3].split(":")[1],
                themes: JSON.parse(rows[j + 4].split(":")[1]),
            };

            events.push(e);
        }

        // Extract themes
        events.forEach(function (d) {
            d.themes.forEach(function (t) {
                if (themes.indexOf(t) === -1) themes.push(t);
            });
        });

        // Format themes from number to string
        console.log(rows[5]);
        var themeObject = JSON.parse(rows[5]); // key = name, value = number
        var inverseThemeObject = {}; // key = number
        for (var key in themeObject) {
            inverseThemeObject[themeObject[key]] = key;
        }
        themes = themes.map(function (t) {
            return inverseThemeObject[t];
        });

        events.forEach(function (d) {
            d.themes = d.themes.map(function (t) {
                return inverseThemeObject[t];
            });
        });

        data = {themes: themes, events: events};
    }

    function formatMC1Data() {

        var events = [];
        //var themes = ["fire", "incident", "inspection", "kidnap", "patch"/*, "ransom"*/, "security"/*, "vip", "POK", "tiskele", "government"*/];
        var themes = ["government", "pok", "gastech", "gas"];
        var format = d3.time.format("%d/%m/%Y %H:%M:%S");

        var TRUST_OPACITY = {
            LOW: 0.2,
            MEDIUM: 0.5,
            HIGH: 1.0
        };

        var trustMetrics = sm.misc.trustMetrics();

        function trustOpacity(rating) {
            switch (trustMetrics.ratingLevel(rating)) {
                case 1:
                    return TRUST_OPACITY.LOW;
                case 2:
                    return TRUST_OPACITY.MEDIUM;
                case 3:
                    return TRUST_OPACITY.HIGH;
            }
            return 0.2;
        }

        /**
         * "Random" number generator from Stack Overflow.
         * Not very random but fast for generating demo data.
         * @type {number}
         */
        var seed = 1;

        function random() {
            var d = 3;
            var x;
            var r = 0.0;
            for (var i = 0; i < d; i++) {
                x = Math.sin(seed++) * 10000;
                r += x - Math.floor(x);
            }
            return r / d;
        }

        // Convert keywords to lower case for string comparisons
        var searchTerms = [];
        themes.forEach(function (d) {
            searchTerms.push(d.toLowerCase());
            //console.log(searchTerms)
        });

        data.forEach(function (d, i) {
            //var rating = d.Trust;
            // Invent a confidence rating

            var rating;
            if (random() > 0.15) {
                rating = String.fromCharCode(65 + Math.floor((random() * 5)));
                rating += 1 + Math.floor((random() * 5));
            }

            var e = {
                id: i,
                title: d.Subject,
                time: format.parse(d.Date),
                sourceType: d.SourceType,
                sourceImageUrl: d.SourceImageUrl,
                confidence: rating,
                trust: trustOpacity(rating),
                relevance: d.Relevance,
                themes: []
            };

            if (e.sourceType === "Article") {
                e.publisher = d.From;
                e.content = d.Content;
            }
            else if (e.sourceType === "EmailHeader") {
                e.from = d.From;
                e.content = "From: " + d.From + "\n\n" + "To: " + d.To;
            }

            if (e.content === undefined) {
                return;
            }
            var s = e.title.toLowerCase();
            var c = e.content.toLowerCase();
            var foundTheme = false;

            searchTerms.forEach(function (k, i) {
                var keyword = themes[i];
                if (s.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                }
                else if (e.sourceType === "Article" && c.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                }

            });

            //If no themes matched, label this element as "other"
            if (foundTheme === false) {
                if (e.themes.indexOf("other") === -1) {
                    e.themes.push("other");
                }
            }

            events.push(e);
        });

        //themes.push("other");
        data = {themes: themes, events: events};
    }

    function formatFacebookUNCData() {
        var events = [];
        //var themes = ["fire", "incident", "inspection", "kidnap", "patch"/*, "ransom"*/, "security"/*, "vip", "POK", "tiskele", "government"*/];
        var themes = ["Clinton",
            "Trump",
            "Obama",
            "Charlotte",
            "GOP",
            "Republicans",
            "Democrats",
            "FBI"];
        // var themes = ["news", "left"];
        var format = d3.time.format("%Y-%d-%m");

        var TRUST_OPACITY = {
            LOW: 0.2,
            MEDIUM: 0.5,
            HIGH: 1.0
        };

        var trustMetrics = sm.misc.trustMetrics();

        function trustOpacity(rating) {
            switch (trustMetrics.ratingLevel(rating)) {
                case 1:
                    return TRUST_OPACITY.LOW;
                case 2:
                    return TRUST_OPACITY.MEDIUM;
                case 3:
                    return TRUST_OPACITY.HIGH;
            }
            return 0.2;
        }

        /**
         * "Random" number generator from Stack Overflow.
         * Not very random but fast for generating demo data.
         * @type {number}
         */
        var seed = 1;

        function random() {
            var d = 3;
            var x;
            var r = 0.0;
            for (var i = 0; i < d; i++) {
                x = Math.sin(seed++) * 10000;
                r += x - Math.floor(x);
            }
            return r / d;
        }

        // Convert keywords to lower case for string comparisons
        var searchTerms = [];
        themes.forEach(function (d) {
            searchTerms.push(d.toLowerCase());
            //console.log(searchTerms)
        });


        //get average uncertainty by news source group
        let groupUncAverage = sm.groupArrBy(data, 'from');

        data.forEach(function (d, i) {
            //var rating = d.Trust;
            // Invent a confidence rating

            // rating and uncertainty applied here using the average, rating and group data
            let rating;
            rating = sm.ratingCalc(d.from, d.Rating, d.comment_count, groupUncAverage);

            // console.log(d);

            var e = {
                id: i,
                title: d.Subject || d.name,
                // title: d.name,
                // time: format.parse(d["Date Published"]),
                time: d.time,
                sourceType: d.SourceType,
                // sourceImageUrl: d.SourceImageUrl,
                sourceImageUrl: d.full_picture,
                confidence: rating.rating,
                trust: trustOpacity(rating.rating),
                relevance: d.Relevance,
                themes: [],
                shareCount: d.share_count,
                source: d.from,
                sourceAvgRating: rating.groupAvg
            };

            if (e.sourceType === "Article") {
                e.publisher = d.from.name;
                // e.content = d.Content;
                e.content = d.description || d.name;
            }

            else if (e.sourceType === "EmailHeader") {
                e.from = d.From;
                e.content = "From: " + d.From + "\n\n" + "To: " + d.To;
            }

            if (e.content === undefined) {
                return;
            }

            var s = e.title.toLowerCase();
            var c = e.content.toLowerCase();
            var foundTheme = false;

            searchTerms.forEach(function (k, i) {
                var keyword = themes[i];
                if (s.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                }
                else if (e.sourceType === "Article" && c.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                }

            });
            //If no themes matched, label this element as "other"
            if (foundTheme === false) {
                if (e.themes.indexOf("other") === -1) {
                    e.themes.push("other");
                }
            }

            events.push(e);
        });
        data = {themes: themes, events: events};
    }

});
