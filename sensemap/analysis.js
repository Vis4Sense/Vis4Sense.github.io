$(function() {
    var participants = [ 'aaron', 'ben', 'mabs', 'magda', 'reggie' ],
    	anonymousParticipants = {
            aaron: 'P1',
            ben: 'P2',
            mabs: 'P3',
            magda: 'P4',
            reggie: 'P5'
        },
        // The maximum amount of ms that the user can be idle but still consider active
        maxIdleTime = 60000,
        // The minimum amount of ms that the use must be in a view to be considered as working,
        // he may just accidentally openning a view and leave immediately
        minWorkingTime = 5000,
        segmentHeight = 20;

    var browserTypes = [ 'search', 'location', 'dir', 'highlight', 'note', 'filter', 'link', 'type', 'bookmark', 'save-image' ],
        colTypes = [ 'remove-collection-node', 'favorite-node', 'unfavorite-node', 'minimize-node', 'restore-node', 'curate-node', 'collection-zoom-in', 'collection-zoom-out' ],
        curTypes = [ 'remove-curation-node', 'move-node', 'add-link', 'remove-link', 'curation-zoom-in', 'curation-zoom-out' ],
        mixedTypes = [ 'click-node', 'revisit' ];

    var margin = { top: 5, right: 5, bottom: 5, left: 5 },
        width = 1000,
        height = 4500,
        chartHeight = 200;

    var browTypesHisto = [ 'highlight', 'note' ],
        colTypesHisto = [ 'favorite-node', 'unfavorite-node', 'minimize-node', 'restore-node' ],
        curTypesHisto = [ 'curate-node', 'remove-curation-node', 'move-node', 'add-link', 'remove-link' ];

    var browColors = [ '#1f77b4', d3.rgb('#1f77b4').brighter().toString() ],
        colColors = [ '#ff7f0e', d3.rgb('#ff7f0e').brighter().toString(), d3.rgb('#ff7f0e').darker().toString(), d3.rgb('#ff7f0e').brighter(2).toString() ],
        curColors = [ '#2ca02c', '#A1A12B', d3.rgb('#2ca02c').brighter(4).toString(),
            d3.rgb('#2ca02c').brighter().toString(), '#B3ED40' ];

    // For paper, just use different hues for curation actions
    curColors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00'];

    var browMaxActions = 5,
        colMaxActions = 21,
        curMaxActions = 60;

    var svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height);

    var columnNames = [ 'participant', 'browser', 'collection', 'curation', 'brow-col', 'brow-cur', 'col-cur',
        'click-node', 'highlight', 'note', 'save-image', 'favorite-node', 'unfavorite-node',
        'minimize-node', 'restore-node', 'curate-node',
        'remove-curation-node', 'move-node', 'add-link', 'remove-link' ];

    buildTableStructure(columnNames);

    addText("ACTIVITIES IN CURATION VIEW", 200, 300, true);

    // Histograms have varied height, manually adjust
    var offsetLookup = {
        'aaron': margin.top + 350,
        'ben': margin.top + 470,
        'mabs': margin.top + 640,
        'magda': margin.top + 780,
        'reggie': margin.top + 880
    }

    participants.forEach((p, i) => {
        var browserPath = "user-study/" + p + "/real/browser.json",
            smPath = "user-study/" + p + "/real/sensemap.json";

        d3.json(browserPath, browserFile => {
            d3.json(smPath, smFile => {
                var browserData = preprocessBrowserData(browserFile);
                var smData = preprocessSenseMapData(smFile);
                var segments = extractSegments(browserData);
                var actions = extractActions(smData);
                var scale = buildScale(segments);
                computeLayout(segments, scale);
                computeStats(segments, actions, columnNames, p);
                buildVis(p, margin.left, margin.top + i * 60, segments, scale);
            });
        });

        var offset = margin.top + 350;
        d3.json(smPath, smFile => {
            var smData = preprocessSenseMapData(smFile);
            var actions = extractActions(smData);
            buildHistogram(p, margin.left, offsetLookup[p], actions, curTypesHisto, curColors, curMaxActions);
        });
    });

    // var offset = margin.top + 1700;
    // addText("ACTIVITIES IN COLLECTION VIEW", 200, offset - 50, true);

    // participants.forEach((p, i) => {
    //     var smPath = "user-study/" + p + "/real/sensemap.json";
    //     d3.json(smPath, smFile => {
    //         offset = margin.top + 1700;
    //         var smData = preprocessSenseMapData(smFile);
    //         var actions = extractActions(smData);
    //         buildHistogram(p, margin.left, offset + i * 250, actions, colTypesHisto, colColors, colMaxActions);
    //     });
    // });

    // offset = margin.top + 3000;
    // addText("ACTIVITIES IN BROWSER", 200, offset - 50, true);

    // participants.forEach((p, i) => {
    //     var smPath = "user-study/" + p + "/real/sensemap.json";
    //     d3.json(smPath, smFile => {
    //         offset = margin.top + 3000;
    //         var smData = preprocessSenseMapData(smFile);
    //         var actions = extractActions(smData);
    //         buildHistogram(p, margin.left, offset + i * 250, actions, browTypesHisto, browColors, browMaxActions);
    //     });
    // });

    function preprocessBrowserData(f) {
        var browserData = f.data;
        browserData.forEach(d => {
            d.time = new Date(d.time);
        });

        // Events should be in temporal already. However, due to message passing, it may be wrong.
        browserData.sort((a, b) => d3.ascending(a.time, b.time));

        return browserData;
    }

    function preprocessSenseMapData(f) {
        // 'click-node' is already 'revisit'
        // 'save-image': forget to save time!
        // smData = smFile.data.filter(d => d.type !== 'revisit' && d.type !== 'save-image');
        var smData = f.data;
        smData.forEach(d => {
            d.time = new Date(d.time);
        });

        return smData;
    }

    function buildScale(segments) {
        var min = d3.min(segments, d => d.startTime),
            max = d3.max(segments, d => d.endTime);
        return d3.time.scale()
            .domain([ min, max ])
            .range([ 0, width ]);
    }

    function extractSegments(browserData) {
        // A segment is a period that the user spends on a particular view
        // It consists of multiple events happening on the same view 
        var lastView, s, segments = [];
        browserData.forEach(d => {
            // type is 'col-xxx', 'cur-xxx', or just 'xxx'
            var hyphenPos = d.type.indexOf('-');
            var view = hyphenPos === -1 ? 'browser' : d.type.substr(0, hyphenPos);

            if (view !== lastView) {
                // Different view, save the current segment and create a new one
                if (s && s.endTime - s.startTime >= minWorkingTime) {
                    segments.push(s);
                }

                s = { view: view, startTime: d.time, endTime: d.time };
                lastView = view;
            } else {
                // Same view. If it isn't too far away from the previous one, combine them.
                // Otherwise, starting a new segment
                if (d.time - s.endTime < maxIdleTime) {
                    s.endTime = d.time;
                } else {
                    // Finish the existing one
                    if (s.endTime - s.startTime >= minWorkingTime) {
                        segments.push(s);
                    }

                    // New one
                    s = { view: view, startTime: d.time, endTime: d.time };
                }
            }
        });

        // The first segment is usually collection because the extension starts on that view.
        // So, should ignore it.
        if (segments[0].view === 'col') segments.shift();
        if (segments[0].view === 'col') segments.shift(); // one participant started very early and did nothing for a while

        return segments;
    }

    function extractActions(smData) {
        return smData.map(d => {
            var view;
            if (browserTypes.includes(d.type)) {
                view = 'browser';
            } else if (colTypes.includes(d.type)) {
                view = 'col';
            } else if (curTypes.includes(d.type)) {
                view = 'cur';
            } else if (mixedTypes.includes(d.type)) {
                view = 'mixed';
            } else {
                console.error('type missed', d.type);
            }

            return {
                view: view,
                time: d.time,
                type: d.type
            };
        });
    }

    function computeLayout(segments, scale) {
        var timeFormat = d3.time.format('%X');

        segments.forEach(s => {
            s.x = scale(s.startTime);
            s.y = 0;
            s.width = Math.max(1, scale(s.endTime) - scale(s.startTime));
            s.height = segmentHeight;

            s.duration = s.endTime - s.startTime;
            s.title = 'start at ' + timeFormat(s.startTime) + ', spent ' + Math.round(s.duration / 1000) + 's in ' + s.view;
        });
    }

    function buildTableStructure() {
        var head = d3.select('thead');
        var tr = head.append('tr');
        columnNames.forEach(c => {
            tr.append('th').attr('class', 'text-center').text(c);
        });

        var localCurTypesHisto = [ 'add node', 'remove node', 'move node', 'add link', 'remove link' ];

        var legend = d3.select('#legend'),
            types = browTypesHisto.concat(colTypesHisto).concat(localCurTypesHisto),
            colors = browColors.concat(colColors).concat(curColors);
        types.forEach((t, i) => {
            legend.append('span').style('background-color', colors[i]).style('padding', '3px').style('margin', '3px').text(t);
        });
    }

    function addCells(tr, ...texts) {
        texts.forEach(t => {
            var td = tr.append('td');

            if (participants.includes(t)) {
                var href = "user-study/" + t + "/screenshot.png";
                td.html("<a target='_blank' href=" + href + ">" + anonymousParticipants[t] + "</a>");
            } else {
                td.text(t);
            }
        });
    }

    function computeStats(segments, actions, columnNames, name) {
        // Build HTML table
        var body = d3.select('tbody');
        var tr = body.append('tr');
        addCells(tr, name);

        // 1. How long did the user spend in each view?
        // -> Sum of segments
        var browserTime = Math.round(d3.sum(segments.filter(s => s.view === 'browser'), d => d.duration) / 1000 / 60),
            colTime = Math.round(d3.sum(segments.filter(s => s.view === 'col'), d => d.duration) / 1000 / 60),
            curTime = Math.round(d3.sum(segments.filter(s => s.view === 'cur'), d => d.duration) / 1000 / 60),
            totalTime = browserTime + colTime + curTime,
            browserTimePercent = Math.round(browserTime / totalTime * 100),
            colTimePercent = Math.round(colTime / totalTime * 100),
            curTimePercent = 100 - browserTimePercent - colTimePercent;
        addCells(tr, browserTime + ' mins (' + browserTimePercent + '%)',
            colTime + ' mins (' + colTimePercent + '%)',
            curTime + ' mins (' + curTimePercent + '%)');

        // 2. How often do they switch among views?
        var browserCol = 0, browserCur = 0, colCur = 0;
        segments.reduce((p, c) => {
            if (p.view !== c.view) {
                if (p.view === 'browser' && c.view === 'col' || p.view === 'col' && c.view === 'browser') browserCol++;
                if (p.view === 'browser' && c.view === 'cur' || p.view === 'cur' && c.view === 'browser') browserCur++;
                if (p.view === 'cur' && c.view === 'col' || p.view === 'col' && c.view === 'cur') colCur++;
            }

            return c;
        });
        addCells(tr, browserCol, browserCur, colCur);

        // 3. Curation support: action stats
        var counts = _.countBy(actions, 'type');
        addCells(tr, ...columnNames.slice(7).map(t => {
            if (t === 'click-node') {
                return counts[t] + '/' + counts.revisit + ' (' + (Math.round(counts[t] / counts.revisit * 100)) + '%)';
            } else {
                return counts[t];
            }
        }));
    }

    function addText(title, left, top, big) {
        title = anonymousParticipants[title] || title;

        svg.append('text')
            .attr("transform", "translate(" + left + "," + top + ")")
            .text(title)
            .style('font-weight', 'bold')
            .style('font-size', big ? '30px' : '22px')
            .style('fill', 'orange');
    }

    function buildVis(title, left, top, segments, scale) {
        // Title
        addText(title, left, top);

        var container = svg.append("g").attr("transform", "translate(" + (left + 30) + "," + top + ")");

        // Axis
        var axis = d3.svg.axis().scale(scale);
        container.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + segmentHeight + ")")
            .call(axis)
            .selectAll("text")
                .attr("y", -2);

        // Segments
        var items = container.selectAll('g.segment').data(segments).enter()
            .append('g').attr('class', 'segment');
        items.append('rect')
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('class', d => d.view)
            .append('title').text(d => d.title);
    }

    function buildHistogram(title, left, top, actions, histoTypes, typeColors, maxActions) {
        // Title
        addText(title, left + 12, top - 10);

        var startTime = actions[0].time;

        // Bin data
        var binDuration = 5 * 60 * 1000,
            numBins = Math.floor((_.last(actions.filter(a => a.type !== 'save-image')).time - startTime) / binDuration) + 1,
            bins = _.times(numBins, () => []);
        actions.filter(a => histoTypes.includes(a.type)).forEach(a => {
            var idx = Math.floor((a.time - startTime) / binDuration);
            bins[idx].push(a);
        });

        var layers = d3.layout.stack()(histoTypes.map(t => {
        	return bins.map((b, i) => {
                return { x: binDuration * i / 60 / 1000, y: b.filter(a => t === a.type).length, type: t };
            });
        }));

        // Draw
        var x = d3.scale.ordinal()
            .rangeRoundBands([ 0, width ]);

        var y = d3.scale.linear()
            .rangeRound([ chartHeight, 0 ]);

        var z = d3.scale.ordinal()
            .domain(histoTypes)
            .range(typeColors);

        // To make all charts for curation having the same domain, ensuring bar widths are unique
        var sharedDomain = [];
        for (var i = 0; i < 24; i++) sharedDomain.push(i * 5);
        // x.domain(layers[0].map(function(d) { return d.x; }));
    	x.domain(sharedDomain);

        // y: same ratio domain/range to save space and comparable
        var localMaxActions = d3.max(bins, b => b.length),
            ratio = localMaxActions / maxActions,
            localChartHeight = chartHeight * ratio;
        y.rangeRound([ localChartHeight, 0 ])
            .domain([ 0, localMaxActions ]);
        console.log(y.domain())

        var container = svg.append("g").attr("transform", "translate(" + (left + 50) + "," + top + ")");
        var layer = container.selectAll(".layer").data(layers)
            .enter().append("g")
                .attr("class", "layer")
                .style("fill", function(d, i) { return z(i); });

        layer.selectAll("rect").data(function(d) { return d; })
            .enter().append("rect")
                .attr("x", function(d) { return x(d.x); })
                .attr("y", function(d) { return y(d.y + d.y0); })
                .attr("height", function(d) { return y(d.y0) - y(d.y + d.y0); })
                .attr("width", x.rangeBand() - 1)
                .append("title").text(d => d.y + ' ' + d.type);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(3)

        container.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + localChartHeight + ")")
            .call(xAxis)
            .selectAll("text")
                .attr("y", -2);

        // Move tick and text to the begining of bin
        var offset = -1 - x.rangeBand() / 2;
        container.selectAll('.axis--x .tick')
            .each(function(d) {
                var x = d3.transform(d3.select(this).attr('transform')).translate[0];
                d3.select(this).attr('transform', 'translate(' + (x + offset) + ',0)');
            });

        container.append("g")
            .attr("class", "axis axis--y")
            .call(yAxis);
    }
});