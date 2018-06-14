$(function() {
    // Data
    // var colors = ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"];
    // var colors = ["#a50026","#f46d43","#fee090","#e0f3f8","#74add1","#313695"];
    colors = ["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"];
    var dataset = "cialeakcase"; // cialeakcase, citations, inception
    var loadData = function() {
        if (dataset === "cialeakcase" || dataset === "citations") {
            d3.json("data/" + dataset + ".json", function(d) {
                data = d;

                // Convert to TimeSets format
                if (dataset === "citations") {
                    formatCitations();
                }

                updateVis();
            });
        } else {
            var fileName = dataset === "inception" ? "Inception_interaction_sessions" : "";
            d3.text("data/" + fileName + ".txt", function(text) {
                // Convert to TimeSets format
                formatMovie(text);

                updateVis();
            });
        }
    };

    loadData();

    // Instantiate vis
    var timesets = sm.vis.timesets()
        .colors(colors)
        // .setMode("background")
        // .applyLayout(false)
        .verticalMode("ellipse")
        .elementMode("gradient")
        .showSettings(true)
        .margin({ top: 0, right: 180, bottom: 0, left: 25 });

    // Update the vis
    var updateVis = function() {
        // Update dimension
        var width = $("svg").width();
        var height = $("svg").height();
        timesets.width(width).height(height - 30);

        d3.select(".sm-timesets-demo").attr("transform", "translate(0, " + height + ")");

        redraw();
    };

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
        var mapPaper = function(p) {
            return { id: p.id, themes: p.concepts, time: new Date(+p.year, 0, 1), title: p.title };
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
        data = data.map(function(d) { return d.papers; }).reduce(function(a, b) { return a.concat(b); });
        data = data.sort(function(a, b) { return d3.descending(+a.gscholar, +b.gscholar); }).slice(0, n);
        var yearCount = {}; // Count articles by year
        data.forEach(function(d) {
            // To count concept frequency
            d.concepts.forEach(function(c) {
                if (!conceptLookup[c]) conceptLookup[c] = 0;
                conceptLookup[c]++;

            });

            if (!yearCount[d.year]) yearCount[d.year] = 0;
            yearCount[d.year]++;

            papers.push(mapPaper(d));
        });

        // Show histogram by year
        var yearPubs = d3.entries(yearCount).sort(function(a, b) { return d3.descending(+a.value, +b.value); });
        console.log(yearPubs);

        // There are many concepts, only show top N
        n = 8;
        var concepts = d3.entries(conceptLookup);
        concepts.sort(function(a, b) { return d3.descending(a.value, b.value); });
        var themes = concepts.slice(0, n).map(function(d) { return d.key; });

        papers.forEach(function(d) {
            d.themes = d.themes.filter(function(t) { return themes.indexOf(t) !== -1; });
        });

        data = { themes: themes, events: papers };
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
        events.forEach(function(d) {
            d.themes.forEach(function(t) {
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
        themes = themes.map(function(t) { return inverseThemeObject[t]; });

        events.forEach(function(d) {
            d.themes = d.themes.map(function(t) { return inverseThemeObject[t]; });
        });

        data = { themes: themes, events: events };
    }
});