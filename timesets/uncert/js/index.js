$(function() {
    // Data
    // var colors = ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"];
    // var colors = ["#a50026","#f46d43","#fee090","#e0f3f8","#74add1","#313695"];
    var colors = [
        '#fccde5',
        '#ffffb3',
        'lightblue',
        '#fb8072',
        '#fdb462',
        '#bebada',
        '#b3de69',
        '#d9d9d9',
        '#bc80bd',
        '#ccebc5',
        '#8dd3c7',
        '#ffed6f',
        '#80b1d3'
    ];
    // var dataset = "mc1data"; // cialeakcase, citations, inception, minich1newsart, minich1emails, mc1data
    var dataset = 'facebookUNC'; // cialeakcase, citations, inception, minich1newsart, minich1emails, mc1data
    //var dataset =  'cialeakcase'; //citations, inception, minich1newsart, minich1emails, mc1data

    //new data push
    let newArray = [];
    var timesets;
    ('');

    let loadData = function() {
        let query = getUrlQueryByName('url') || 'https://docs.google.com/spreadsheets/d/1SwIizq1WMnpE9xdeWHuD5PoOnyVRcxsfAQtgdw92S84/edit?usp=sharing'
        // let query = getUrlQueryByName('url') || 'https://docs.google.com/spreadsheets/d/1l6zslga3nAbbKVRswlHWubkxA3M_USThM0uhlpAzzFE/edit?usp=sharing'

        let publicSpreadsheetUrl = query ;
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
            let themes = data.themes.elements;
            let newThemes = [];
            themes.forEach(function(d) {
                newThemes.push(d.theme);
            });

            //hide loader
            if (document.getElementById('loading')) {
                document.getElementById('loading').style.display = 'none';
            }

            init(newdata, newThemes);
        }

        let count = 0;

        function init(d, themes) {
            var format = d3.time.format('%Y-%m-%dT%H:%M:%S+0000');

            data = d;
            data.forEach(function(d) {
                d.description = d.details;
                d.Rating = d.uncertainty;
                d.SourceType = 'Article';
                d.Content = d.content || d.name;
                d.comment_count = d.influence;
                d.share_count = d.influence;
                
                d.Subject = d.name;
                d.from = d.entity;
                d.From = d.entity;
                d.Trust = 'C3';
                d.Relevance = 4;
                d.time = moment(d.time).format();

                //rating conversion from string to values
                d.Rating = sm.convertRating(d.Rating);
            });

            // Convert to TimeSets format
            formatFacebookUNCData(themes);

            // Create the trust filter.
            var trustFilter = sm.misc.trustFilter().on('trustfilterchanged', function(trustFilter) {
                timesets.trustFilter(trustFilter);
                timesets.update(null, false);
            });
            trustFilter();

            timesets.trustFilter(trustFilter.filter());

            updateVis();
        }

        //hide and update iframe, and buttons
        if (query) {
            d3.selectAll('#datamodalbutton').classed('hide', false);
            document.getElementById('sheetIframe').src = query;
        } else {
            d3.selectAll('#datamodalbutton').classed('hide', true);
        }

        if (query) {
            documentReady(function() {
                init_table();
            });
        } else {
            var format = d3.time.format('%Y-%m-%dT%H:%M:%S+0000');
            d3.json('data/fbv3.json', function(d) {
                //hide loader
                if (document.getElementById('loading')) {
                    document.getElementById('loading').style.display = 'none';
                }
                data = d;
                data.forEach(function(d) {
                    d.SourceType = 'Article';

                    d.Content = d.name || d.description;

                    if (d.description === '' || ' ') {
                        d.Content = d.message;
                    }
                    d.from = d.from.name;
                    d.Subject = d.name;
                    d.Trust = 'C3';
                    d.Relevance = 4;
                    if (d.time) {
                        d.time = format.parse(d.time);
                    } else {
                        d.time = format.parse('2016-09-19T03:00:51+0000');
                    }
                    //rating conversion from string to values
                    d.Rating = sm.convertRating(d.Rating);
                    // rating setup
                    // console.log(d);
                });

                // Convert to TimeSets format
                formatFacebookUNCData();

                // Create the trust filter.
                var trustFilter = sm.misc
                    .trustFilter()
                    .on('trustfilterchanged', function(trustFilter) {
                        timesets.trustFilter(trustFilter);
                        timesets.update(null, false);
                    });
                trustFilter();

                timesets.trustFilter(trustFilter.filter());

                updateVis();
            });
        }
    };

    $('.sidebar-resizer').bind('click', function() {
        var aside = $('aside');
        aside.toggle();

        if (aside.css('display') === 'none') {
            $('.sidebar-resizer').css('left', '0px');
        } else {
            $('.sidebar-resizer').css('left', aside.width());
        }
    });

    loadData();

    var resizer = $('.sidebar-resizer');
    var aside = $('aside');

    let margin = { top: 15, right: 85, bottom: 0, left: aside.width() + 15 };

    // Instantiate vis
    timesets = sm.vis
        .timesets()
        .colors(colors)
        // .setMode("background")
        // .applyLayout(false)
        .verticalMode('ellipse')
        .elementMode('circles')
        .showSettings(false)
        .margin(margin);

    // Update the vis
    var updateVis = function() {
        // Update dimension
        var FOOTER_BORDER_SIZE = 0;
        var FUDGE_FIGURE = 0; // something to do with a timesets svg group transform

        var middle = $('.middle');
        // middle.height(window.innerHeight - middle.position().top - $("footer").height() - FUDGE_FIGURE - FOOTER_BORDER_SIZE);
        middle.height(window.innerHeight - (margin.top + $('footer').height()));
        // middle.height(window.innerHeight - (margin.top + 160 + FUDGE_FIGURE + FOOTER_BORDER_SIZE));

        var width = window.innerWidth;
        var height = middle.height();

        // prevent oversized height
        $('svg').height(height);
        $('svg').width(width);
        timesets.width(width).height(height);
        d3.select('.sm-timesets-demo').attr('transform', 'translate(0, ' + height + ')');

        redraw();
        resizer.css('top', (aside.height() - resizer.height()) / 2).css('left', aside.width());

        $('body').css('visibility', 'visible');

        //update filter
    };

    // Add a listener to the window to show the settings
    $('body').on('keyup', function(e) {
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
        d3.select('.sm-timesets-demo')
            .datum(data)
            .call(timesets);
    }


    function formatFacebookUNCData(extThemes) {
        var events = [];
        //var themes = ["fire", "incident", "inspection", "kidnap", "patch"/*, "ransom"*/, "security"/*, "vip", "POK", "tiskele", "government"*/];
        var themes = extThemes || [
            'Clinton',
            'Trump',
            'Obama',
            'Charlotte',
            'GOP',
            'Republicans',
            'Democrats',
            'FBI',
            'other'
        ];
        // var themes = ["news", "left"];
        var format = d3.time.format('%Y-%d-%m');

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
        themes.forEach(function(d) {
            searchTerms.push(d.toLowerCase());
            //console.log(searchTerms)
        });

        //get average uncertainty by news source group
        let groupUncAverage = sm.groupArrBy(data, 'from');

        // console.log(groupUncAverage);

        data.forEach(function(d, i) {
            //var rating = d.Trust;
            // Invent a confidence rating

            // console.log(d)

            // rating and uncertainty applied here using the average, rating and group data
            let rating;
            rating = sm.ratingCalc(d.from, d.Rating, d.comment_count, groupUncAverage);

            // console.log(d);

            var e = {
                id: i,
                title: d.Subject || d.title,
                time: d.time,
                sourceType: d.SourceType,
                // sourceImageUrl: d.SourceImageUrl,
                sourceImageUrl: d.picture,
                confidence: rating.rating,
                trust: trustOpacity(rating.rating),
                relevance: d.Relevance,
                themes: [],
                shareCount: d.share_count,
                source: d.from,
                sourceAvgRating: rating.groupAvg,
                influence: d.influence || 0,
                from: d.from
            };

            if (e.sourceType === 'Article') {
                e.publisher = d.from;
                // e.content = d.Content;
                e.content = d.description || d.name;
            } else if (e.sourceType === 'EmailHeader') {
                e.from = d.from;
                e.content = 'From: ' + d.from + '\n\n' + 'To: ' + d.To;
            }

            if (e.content === undefined) {
                return;
            }
            var s = e.title.toLowerCase();
            var c = e.content.toLowerCase();
            var foundTheme = false;

            searchTerms.forEach(function(k, i) {
                var keyword = themes[i];
                if (s.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                } else if (e.sourceType === 'Article' && c.indexOf(k) >= 0) {
                    if (e.themes.indexOf(keyword) === -1) {
                        e.themes.push(keyword);
                    }
                    foundTheme = true;
                }
            });
            //If no themes matched, label this element as "other"
            if (foundTheme === false) {
                if (e.themes.indexOf('other') === -1) {
                    e.themes.push('other');
                }
            }

            events.push(e);
        });
        data = { themes: extThemes || themes, events: events };
    }
});
