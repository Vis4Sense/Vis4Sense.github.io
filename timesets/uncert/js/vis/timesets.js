/*
 * TIME-SETS module provides a representation for temporal data/events.
 * Data format: requires:
 * .time: Date object
 * .title: String
 * .content: String
 * .themes: an array of themes; e.g., ["Information Visualisation", "Visual Analytics"]
 */
sm.vis.timesets = function() {
    var width = 800, height = 500,
        margin = { top: 20, right: 30, bottom: 20, left: 20 },
        THEME_CIRCLE_RADIUS = 6,
        TIME_BAR_HEIGHT = 6,
        DARKER_RATIO = 0.5,
        LEGIBILITY_PADDING = 5, // Minimum void space between two events (text end of the first and start of the second) in the same level
        LEVEL_HEIGHT = 26, // Height of each level 26px:16pt-font
        // LEVEL_HEIGHT = 100,
        CORNER_RADIUS = 10,
        CLUSTER_HEIGHT = LEVEL_HEIGHT - 4, // Should be smaller than LEVEL_HEIGHT
        MAX_NUM_CHARS = 50, // The maximum characters to display for 'alwaysTrim' events
        minEventWidth = 50, // An event has to be aggregated if the remaining space for it less than this value
        trimThresholdRatio = 0.1; // Can only trim an event so that a new event can stay in the same row if the remaining part is larger than this value

	var EVENT_TEXT_DY = timesetsProperties.eventText_dy? timesetsProperties.eventText_dy : 9; // Amount to offset the y-value of the event title. Depends on font size and rendering engine.
	var EVENT_SELECTION_TIME_TEXT_dy = timesetsProperties.eventSelectionTimeText_dy? timesetsProperties.eventSelectionTimeText_dy : ".71em";

    var data, layerisedData, nonSetData, allData,
        activeData, activeNonSetData, allActiveData,
        links,
        themes, activeThemeIds,
        layerEvents, // Store events grouped by layer
        xScale = d3.time.scale(),
        xAxis = d3.svg.axis().scale(xScale).orient("bottom").tickSize(6, 0),
        xAxis2 = d3.svg.axis().scale(xScale).orient("top").tickSize(0, 0),
        scale = 1, // Zoom scale
        translate = [0, 0],
        zoom = d3.behavior.zoom().x(xScale),
        parent, // The selection input
        container, // The g element containg the whole group
        axisGroup, // The g element containg the axis
        axisGroup2, // The g element containg the axis
        eventGroup, // The g element containg all events
        linkGroup, // The g element containg all links
        clusterGroup, // The g element containg all clusters of events
        outlineGroup, // The g element containg all outlines
        outlineBorderGroup, // The g element containg all outline borders
        timeTooltipGroup, // The g element containg the time tooltip
        boundaryGroup, // The g element containing all polygonal boundaries, for testing intersections
        events, // The selection of events, each is a g element contaning the whole DOM of the event
        allLinks; // d3-selection of links

    var maxLevel, // The maximum level of the timeSets
        numThemes, // The number of themes
        numLayers = 1, // The number of visual layers
        orderToId, // The mapping from rendering order of theme to its id
        idToOrder, // The mapping from it to its rendering order of theme
        assignedLayers, // Information of levels for each layer
        colors, // Colors used for sets
        sameOrderColor = true, // If true, colors are mapped to rendering order, not to themes
        legend,
        trustMetrics = sm.misc.trustMetrics(),
        trustMatrix = sm.misc.trustMatrix(),
        trustBadge = sm.misc.trustBadge(),
        wordCloud = sm.misc.wordCloud(),
        trustFilter,
        activeMetrics,
        activeTheme = "",
        id = 0;
    var dispatch = d3.dispatch("eventClicked");

    var maxOptimizationTime = 100; // Time allow for optimizing balancing levels of details, in ms

    // Mode configuration
    var longTick = false,
        setMode = "path", // color/path/line/local/background
        shapeMode = "wholevis", // layer/set/wholevis
        applyLayout = true,
        elementMode = "circles", // rings/circles/none/gradient
        intersectionMode = "color-blending2", // color-blending1/color-blending2/gradient1/gradient2/texture
        layoutMode = "middle", // bottom/middle
        usePicture = false,
        balancingMode = false,
        compactingMode = false,
        showCirleForIntervals = false,
        showSettings = false,
        showCapture = false,
        filled = true, // Fill the path or stroke it
        dotColor = "white", // white or steelblue
        verticalMode = "rounded",
        eventViewer = sm.misc.articleViewer(),
        trustViewer = sm.misc.trustViewer(),
        showNonSetEvents = false,
        aggregateLevel = "neighbor"; // none/neighbor/subset/set

    var settingsUi;

    // Key function based on "id" property, used when binding data
    var key = function(d) {
        return d.id;
    };

    var linkKey = function(d) {
        return d.source.id + "#" + d.target.id;
    };

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(theData) {
            // Initialise
            data = theData.events;
            data.forEach(function(d) {
                if (!(d.time instanceof Date)) {
                    d.time = new Date(d.time);
                }
                if (d.endTime && !(d.endTime instanceof Date)) {
                    d.endTime = new Date(d.endTime);
                }
            });

            themes = theData.themes;
            numThemes = themes.length;

            parent = d3.select(this);
            container = parent.append("g");
            xScale
                .domain(d3.extent(data, function(d) { return d.time; }))
                .rangeRound([0, width - margin.left - margin.right]);

            // Update the inner dimensions
            container.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Events
            outlineGroup = container.append("g");
            outlineBorderGroup = container.append("g");
            outlineGroup.attr("transform", "translate(" + -margin.left + ",0)"); // Use absolute coordinates later
            outlineBorderGroup.attr("transform", "translate(" + -margin.left + ",0)"); // Messed up with margin.top, not translate it!
            clusterGroup = container.append("g");
            eventGroup = container.append("g");
            linkGroup = container.append("g");
            boundaryGroup = container.append("g");

            // Timesets axis
            axisGroup = container.append("g")
                .classed("sm-timeSets-svg-axis", true)
                .attr("transform", "translate(0," + (-margin.bottom - 30) + ")");
            axisGroup2 = container.append("g")
                .classed("sm-timeSets-svg-axis", true)
                .attr("transform", "translate(0," + (-margin.bottom - 20 - height) + ")");

            // Zoom/pan
            zoom.on("zoom", function() {
                if (scale === d3.event.scale) { // Pan
                    module.update(null, false); // Should update immediately to sync. with the axis
                } else { // Zoom
                    scale = d3.event.scale;
                    module.update(null, true);
                }
                translate = d3.event.translate;
            });

            // Set zoom for the parent of the selection
            d3.select(parent.node().parentNode)
                .call(zoom)
                .on("dblclick.zoom", null);

            // Assign theme ids
            data.forEach(function(d) {
                var themeIds = d.themes.filter(function(t) {
                    return themes.indexOf(t) !== -1;
                }).map(function(t) {
                    return themes.indexOf(t);
                });

                d.themeIds = themeIds.sort();
            });

            // Time axis tooltip
            createTimeAxisTooltip();

            // Add the generate word cloud button
            wordCloud.addButton("Generate", "", function() {
                wordCloud(activeMetrics, activeData, activeTheme);
            });

            // Main job here
            // Apply scale
            zoom.translate(translate).scale(scale);
            module.update(theData);

            buildResetZoom();

            if (showCapture) {
                buildCapture();
            }

            if (showSettings) {
                module.showSettings(showSettings);
            }

            // buildHelp();

            // module.update(null, true);
        });
    }

    /**
     * Updates the timeSets with new data.
     */
    module.update = function(theData, transitionEffect) {
        // Update with new data
        xScale.rangeRound([0, width - margin.left - margin.right]);

        if (theData) {
            data = theData.events;
            themes = theData.themes;
            numThemes = themes.length;
            activeThemeIds = d3.range(numThemes).map(function() { return true; });

            var domain = d3.extent(data, function(d) { return d.time; });
            xScale.domain(domain);

            // Sort data by time ascendingly for easy computing layout
            data.sort(function(a, b) {
                if (a.time.getTime() === b.time.getTime()) {
                    return d3.ascending(a.title.length, b.title.length);
                }

                return d3.ascending(a.time, b.time);
            });

            zoom.x(xScale);

            // Note: DO NOT change order of calls below
            splitNonSetEvents(true);

            nonSetData = aggregateSameLabelEvents(nonSetData);
            data = aggregateSameLabelEvents(data);

            forceTrimEvents();

            combineEvents();

            // addParentEvents();

            updateAggregatedLabels();

            splitNonSetEvents();

            setUniqueIds();

            // Find order of themes to maximise shared events visualised (neighbouring events)
            if (applyLayout) {
                orderToId = computeThemeOrderingBruteForce();
                idToOrder = computeInverseOrder();
            }

            // Assign events to layers, probably modify the original data to replicate some events
            layeriseEvents();

            // Create links
            links = theData.links || [];
            links.forEach(function(l) {
                l.source = data[+l.source];
                l.target = data[+l.target];
            });
            links = links.filter(function(d) { return d.source && d.target; });

            // Legend
            var legendData = themes.map(function(d, i) {
                var themeId = applyLayout ? orderToId[i] : i;
                return {
                    color: cScale(themeId),
                    text: themes[themeId]
                };
            });

            if (applyLayout) {
                legendData.reverse();
            }

            legend = sm.misc.legend()
                .sortable(applyLayout)
                .on("selected", function(e) {
                    if (applyLayout) {
                        // Reverse and convert from index to id
                        e.reverse();
                        e.forEach(function(d, i) {
                            activeThemeIds[orderToId[i]] = d;
                        });

                        layeriseEvents();
                    } else {
                        activeThemeIds = e;
                    }
                    module.update(null, true);
                    dehighlightEvents();
                })
                // .on("mouseover", function(e) {
                //     highlightTheme(applyLayout ? numThemes - e - 1 : e);
                //     if (setMode === "path") {
                //         highlightPathBorder(numThemes - e - 1);
                //     }
                // }).on("mouseout", function() {
                //     dehighlightEvents();
                // })
                .on("changed", function(e) {
                    // Update orderToId
                    var indices = d3.range(numThemes);
                    var startIndex = numThemes - e.startIndex - 1;
                    var stopIndex = numThemes - e.stopIndex - 1;
                    indices.splice(startIndex, 1);
                    indices.splice(stopIndex, 0, startIndex);
                    var newOrderToId = new Array(numThemes);
                    for (var i = 0; i < numThemes; i++) {
                        newOrderToId[i] = orderToId[indices[i]];
                    }
                    orderToId = newOrderToId;

                    layeriseEvents();
                    module.update(null, true);
                })
                .on("badgeclicked", function(theme) {

                    if (arguments.length >= 1 && theme !== undefined) {
                        if (activeTheme === theme) {
                            activeTheme = ""; // metrics apply to all themes
                        }
                        else {
                            activeTheme = theme; // metrics apply to this theme only
                        }
                    }

                    activeMetrics = trustMetrics(activeData, activeTheme);
                    trustMatrix(activeMetrics, activeTheme);
                    trustBadge(activeMetrics);
                    wordCloud(activeMetrics, activeData, activeTheme);
                });
            parent.datum( { data: legendData, background: applyLayout || setMode === "background", title: "Themes" }).call(legend);
		}

        // Display only data in the active (visible) time range and not filtered
        var sourceData = applyLayout ? layerisedData : data;

        activeData = sourceData.filter(function(d) {
            // OR condition, at least one active theme exists
            if (!d.themeIds.some(function(i) { return activeThemeIds[i]; })) {
                return false;
            }

            // Test the confidence level against the trust filter
            if (trustFilter) {
                if (d.confidence) {

                    if (!trustFilter.has(trustMetrics.ratingLevel(d.confidence))) {
                        return false;
                    }
                }
                else if (!trustFilter.has(trustMetrics.RATING_LEVELS().LOW) && trustFilter.size() !== 0) {
                    // This item does not have a trust rating and the low rating is not selected in the filter.
                    return false;
                }
            }

            // By time
            var lerp = (xScale(d.time) - xScale.range()[0]) / (xScale.range()[1] - xScale.range()[0]);
            return lerp >= 0 && lerp <= 1;
        });

        // allActiveData = allData.filter(function(d) {
        //     // Include non-set events
        //     if (!d.themeIds || !d.themeIds.length) { return true; }

        //     // OR condition, at least one active theme exists
        //     if (!d.themeIds.some(function(i) { return activeThemeIds[i]; })) {
        //         return false;
        //     }

        //     // By time
        //     var lerp = (xScale(d.time) - xScale.range()[0]) / (xScale.range()[1] - xScale.range()[0]);
        //     return lerp >= 0 && lerp <= 1;
        // });

        // activeNonSetData = nonSetData.filter(function(d) {
        //     // By time
        //     var lerp = (xScale(d.time) - xScale.range()[0]) / (xScale.range()[1] - xScale.range()[0]);
        //     return lerp >= 0 && lerp <= 1;
        // });

        // Organise events by its layer
        if (applyLayout) {
            layerEvents = d3.range(numLayers).map(function() { return []; });
            activeData.forEach(function(d) {
                try {
                    layerEvents[d.layer].push(d);
                } catch (e) {
                    console.log(e);
                }
            });
        }

        // Timesets axis
        axisGroup.call(xAxis);
        if (longTick) {
            axisGroup.selectAll("text").attr("dy", ".95em"); // Adjust due to tick lines above axis
            axisGroup.classed("sm-timeSets-svg-axis-dashed", true);
            if (axisGroup.selectAll(".tick").size() > 6) {
                console.log("Regenerate the dataset");
                throw "Too many ticks";
            } else if (axisGroup.select(".tick").text() === "2003") {
                console.log("Regenerate the dataset");
                throw "Start with 2003";
            }

            // Top axis
            axisGroup2.call(xAxis2);
        }

        // Events
        updateEvents(theData || transitionEffect ? sm.TRANSITION_MOVEMENT : 0);

        // Links between events
        updateLinks();

        // Update dependencies

        // Legend
        legend.updateTrust(activeData);

        activeMetrics = trustMetrics(activeData);

        // Trust histogram
        trustMatrix(activeMetrics);

        // Trust badge
        trustBadge(activeMetrics);

        // Remove word cloud
        //wordCloud.removeVis();
        wordCloud(activeMetrics, activeData, activeTheme);

        return this;
    };

    function updateEvents(duration) {
        // DATA JOIN
        events = eventGroup.selectAll("g").data(activeData, key);

        // ENTER
        // - Container
        var enterGroup = events.enter().append("g");
        enterGroup
            .classed("sm-timeSets-svg-event", true)
            .attr("transform", function() { return "translate(" + -width + ", 0)"; });

        // - Background for individual events
        enterGroup.append("rect")
            .classed("sm-timeSets-svg-event-background", true)
            .attr("x", function (d) { return getGlyphPadding(d); } )
            .attr("y", -CLUSTER_HEIGHT / 2)
            // .attr("rx", 8)
            // .attr("ry", 8)
            .attr("height", CLUSTER_HEIGHT)
            .style("opacity", "0");

        // - Selection border
        enterGroup.append("rect")
            .classed("sm-timeSets-svg-event-selection", true)
            .attr("x", function (d) { return getGlyphPadding(d) - 2; } )
            .attr("y", -CLUSTER_HEIGHT / 2)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("height", CLUSTER_HEIGHT)
            .style("display", "none");

        // - Selection text, overwrite existing text
        enterGroup.append("text")
            .classed("sm-timeSets-svg-event-selection-text", true)
            .text(function(d) { return d.originalTitle; } )
            .attr("x", getGlyphPadding)
            .attr("dy", EVENT_TEXT_DY)
            .style("display", "none");

        // - Theme glyphs
        enterGroup.each(function(d) {
            if (usePicture && d.image) {
                return;
            }

            var self = this;
            if (!d.endTime || showCirleForIntervals) {
                if (elementMode === "rings") { // One concentric rings circle
                    d.themeIds.forEach(function(themeId, i) {
                        d3.select(self).append("circle")
                            .attr("cx", 0)
                            .attr("r", THEME_CIRCLE_RADIUS * (d.themeIds.length - i + 0.25))
                            .attr("fill", d3.rgb(cScale(themeId)).darker(DARKER_RATIO));
                    });

                    // White in the middle
                    d3.select(self).append("circle")
                        .attr("cx", 0)
                        .attr("r", THEME_CIRCLE_RADIUS * 0.5)
                        .attr("fill", "white");
                } else if (elementMode === "circles") { // Replicate circles for each theme
                    d.themeIds.forEach(function(themeId, i) {
                        var color = cScale(themeId);
                        if (applyLayout) {
                            color = d3.rgb(color).darker(DARKER_RATIO);
                        }

                        d3.select(self).append("circle")
                            .attr("cx", (THEME_CIRCLE_RADIUS * 2 + 1) * i)
                            .attr("r", THEME_CIRCLE_RADIUS)
                            .attr("fill", color)
                            .classed("sm-timeSets-circle-border", elementMode === "circles");
                    });
                } else { // Just a dot
                    d3.select(self).append("circle")
                        .attr("cx", 0)
                        .attr("r", THEME_CIRCLE_RADIUS)
                        .attr("fill", function(d) { return d.hasSet && applyLayout ? dotColor : "steelblue"; });
                }
            }

            // Time bar
            if (d.endTime) {
                d3.select(self).append("rect")
                    .attr("x", 0)
                    .attr("y", -CLUSTER_HEIGHT / 2 - TIME_BAR_HEIGHT + 5)
                    .attr("width", xScale(d.endTime) - xScale(d.time))
                    .attr("height", TIME_BAR_HEIGHT)
                    .attr("fill", function(d) { return d.hasSet && applyLayout ? dotColor : "steelblue"; });
            }
        });

        // - Text or Image
        enterGroup.each(function(d) {
            if (!usePicture || !d.image) {
                d3.select(this).append("text")
                    .classed("sm-timeSets-svg-event-text", true)
                    .style("font-style", function(d) { return d.isParent ? "italic" : "normal"; })
                    .style("opacity", function(d) { return d.trust; })
                    .text(function(d) { return d.title; } )
                    .attr("x", getGlyphPadding)
                    .attr("dy", EVENT_TEXT_DY) // 9 for 26px level-height?
                    .on("mouseover", function(d) {
                        // highlightLayer(d.layer);
						if (timesetsProperties.platform !== "IE") {
							showHideTooltip(true, this, d);
						}
                    }).on("mouseout", function(d) {
                        dehighlightEvents();
                        showHideTooltip(false, this, d);
                        legend.dehighlightRows();
                    }).on("click", function(d) {
                        d.x = d3.event.pageX;
                        d.y = d3.event.pageY;
                        d3.select(this).call(eventViewer).call(trustViewer);
                    }).on("touchend", function(d) {
                        d.x = d3.event.pageX;
                        d.y = d3.event.pageY;
                        d3.select(this).call(eventViewer).call(trustViewer);
                    });
            } else {
                var textHeight = 20;
                var imageHeight = LEVEL_HEIGHT - textHeight - 4;
                d3.select(this).append("image")
                    .attr("x", getGlyphPadding)
                    .attr("y", -LEVEL_HEIGHT / 2 + 2)
                    .attr("height", imageHeight)
                    .attr("width", imageHeight)
                    .attr("xlink:href", function(d) { return d.image; })
                    .on("mouseover", function(d) {
                        d3.select(this).style("cursor", "pointer");
                    }).on("mouseout", function(d) {
                        d3.select(this).style("cursor", "default");
                    }).on("click", function(d) {
                        d.x = d3.event.pageX;
                        d.y = d3.event.pageY;
                        d3.select(this).call(eventViewer).call(trustViewer);
                    });

                // Title text
                d3.select(this).append("foreignObject")
                    .classed("sm-timeSets-svg-event-picture-text", true)
                    .attr("x", getGlyphPadding)
                    // .attr("y", -LEVEL_HEIGHT / 2 + imageHeight + 1)
                    .attr("y", function(d) { return -LEVEL_HEIGHT / 2 + (d.image ? imageHeight : 1) + 1; })
                    .attr("width", imageHeight)
                    .attr("height", "1.9em")
                        .append("xhtml:div")
                        .text(function(d) { return d.title; } )
            }
        });

        // TODO:picture
        // enterGroup.selectAll(".sm-timeSets-svg-event-selection").attr("width", function() { return d3.select(this.parentNode).select(".sm-timeSets-svg-event-text").node().getComputedTextLength() + 5; });

        // ENTER + UPDATE
        // - Update contents
        events.each(function(d) { // Data is bounded to the container, so it stores up-to-date data.
            d3.select(this).selectAll(".sm-timeSets-svg-event-text").text(function() { return d.title; } );
        });

        // - Update events location
        computeLayout(duration);

        // EXIT
        events.exit().remove();
    }

    function updateLinks() {
        // DATA JOIN
        allLinks = linkGroup.selectAll("g").data(links, linkKey);

        // ENTER
        var g = allLinks.enter().append("g");
        g.attr("class", "sm-timeSets-link");

        g.each(function(d) {
            var source = d.source;
            var target = d.target;

            if (source.ref && target.ref) {
                // Use translate component of transform as coordinates
                var t1 = d3.transform(d3.select(source.ref).attr("transform")).translate;
                var t2 = d3.transform(d3.select(target.ref).attr("transform")).translate;

                d3.select(this).append("line")
                    .attr("x1", t1[0]).attr("y1", t1[1])
                    .attr("x2", t2[0]).attr("y2", t2[1]);
            }
        });
    }

    function updateTimeCircles() {
        // Circles
        events.selectAll("circle").remove();
        events.each(function(d) {
            var self = this;
            if (!d.endTime || showCirleForIntervals) {
                if (elementMode === "rings") { // One concentric rings circle
                    d.themeIds.forEach(function(themeId, i) {
                        d3.select(self).append("circle")
                            .attr("cx", 0)
                            .attr("r", THEME_CIRCLE_RADIUS * (d.themeIds.length - i + 0.25))
                            .attr("fill", d3.rgb(cScale(themeId)).darker(DARKER_RATIO));
                    });

                    // White in the middle
                    d3.select(self).append("circle")
                        .attr("cx", 0)
                        .attr("r", THEME_CIRCLE_RADIUS * 0.5)
                        .attr("fill", "white");
                } else if (elementMode === "circles") { // Replicate circles for each theme
                    d.themeIds.forEach(function(themeId, i) {
                        var color = cScale(themeId);
                        if (applyLayout) {
                            color = d3.rgb(color).darker(DARKER_RATIO);
                        }

                        d3.select(self).append("circle")
                            .attr("cx", (THEME_CIRCLE_RADIUS * 2 + 1) * i)
                            .attr("r", THEME_CIRCLE_RADIUS)
                            .attr("fill", color);
                    });
                } else { // Just a white dot
                    d3.select(self).append("circle")
                        .attr("cx", 0)
                        .attr("r", THEME_CIRCLE_RADIUS)
                        .attr("fill", function(d) { return d.hasSet && applyLayout ? dotColor : "steelblue"; });
                }
            }

            // Time bar
            if (d.endTime) {
                d3.select(self).append("rect")
                    .attr("x", 0)
                    .attr("y", -CLUSTER_HEIGHT / 2 - TIME_BAR_HEIGHT + 5)
                    .attr("width", xScale(d.endTime) - xScale(d.time))
                    .attr("height", TIME_BAR_HEIGHT)
                    .attr("fill", function(d) { return d.hasSet && applyLayout ? dotColor : "steelblue"; });
            }
        });

        // Text
        events.selectAll("text.sm-timeSets-svg-event-text").each(function(d) {
            if (!usePicture || !d.image) {
                d3.select(this).text(function(d) { return d.title; } )
                    .attr("x", getGlyphPadding);
            }
        });

        // Background for individual events
        events.selectAll(".sm-timeSets-svg-event-background")
            .attr("x", function (d) { return getGlyphPadding(d); } );

        // Selection border
        events.selectAll(".sm-timeSets-svg-event-selection")
            .attr("x", function (d) { return getGlyphPadding(d) - 2; } );

        // Selection text, overwrite existing text
        events.selectAll(".sm-timeSets-svg-event-selection-text")
            .attr("x", getGlyphPadding);
    }

    /**
     * Returns the distance from the centre of the glyph to the text.
     */
    function getGlyphPadding(d) {
        var themeCount = d.themeIds !== undefined ? d.themeIds.length : 0;
        return d.endTime && !showCirleForIntervals
            ? 0
            : (usePicture && d.image)
                ? 0
                : elementMode === "circles"
                    ? (THEME_CIRCLE_RADIUS * 2 + 1) * themeCount - THEME_CIRCLE_RADIUS + 2
                    : elementMode === "rings" ? THEME_CIRCLE_RADIUS * (themeCount + 0.5) + 2 : THEME_CIRCLE_RADIUS + 2;
    }

    /**
     * Creates tooltip for time axis.
     */
    function createTimeAxisTooltip() {
        timeTooltipGroup = container.append("g")
            .attr("transform", "translate(0," + (-margin.bottom - 30) + ")")
            .style("display", "none");

        timeTooltipGroup.append("rect")
            .classed("sm-timeSets-svg-event-selection", true)
            .classed("startTime", true)
            .attr("y", 2)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("height", CLUSTER_HEIGHT);

        timeTooltipGroup.append("text")
            .classed("sm-timeSets-svg-event-selection-text", true)
            .classed("startTime", true)
            .attr("y", 11)
            .attr("dy", EVENT_SELECTION_TIME_TEXT_dy);

        // End time
        timeTooltipGroup.append("rect")
            .classed("sm-timeSets-svg-event-selection", true)
            .classed("endTime", true)
            .attr("y", -CLUSTER_HEIGHT)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("height", CLUSTER_HEIGHT);

        timeTooltipGroup.append("text")
            .classed("sm-timeSets-svg-event-selection-text", true)
            .classed("endTime", true)
            .attr("y", -CLUSTER_HEIGHT + 8)
            .attr("dy", EVENT_SELECTION_TIME_TEXT_dy);
    }

    /**
     * Shows/Hides inline tooltip.
     */
    function showHideTooltip(visible, ref, d) {
        if (visible) {
            var startTime, endTime;

            if (!d.length) {
                startTime = d.time;
                endTime = d.endTime;

                // Text
                showHideFullText(true, ref);

                // Highlight replicated events
                events.each(function(d2) {
                    if (d2.oID && d2.oID === d.oID && d2.id !== d.id) {
                        showHideFullText(true, d3.select(this).select(".sm-timeSets-svg-event-text").node());
                    }
                });
            } else {
                startTime = d[0].time;
                endTime = startTime;
                d.forEach(function(d2) {
                    endTime = Math.max(endTime, d2.time);
                    if (d2.endTime) {
                        endTime = Math.max(endTime, d2.endTime);
                    }
                });
                endTime = new Date(endTime);
            }

            // Time
            timeTooltipGroup.style("display", "block");
            timeTooltipGroup.attr("transform", "translate(" + xScale(startTime) + "," + (-margin.bottom - 30) + ")");
            timeTooltipGroup.select("text.startTime").attr("x", getGlyphPadding(d)).text(d3.time.format("%d-%m-%Y")(startTime));
            timeTooltipGroup.select("rect.startTime").attr("x", getGlyphPadding(d) - 2).attr("width", timeTooltipGroup.select("text").node().getBoundingClientRect().width + 5);

            if (endTime) {
                timeTooltipGroup.selectAll(".endTime").style("display", "block");
                timeTooltipGroup.select("text.endTime").attr("x", getGlyphPadding(d) + xScale(endTime) - xScale(startTime)).text(d3.time.format("%d-%m-%Y")(endTime));
                timeTooltipGroup.select("rect.endTime").attr("x", getGlyphPadding(d) + xScale(endTime) - xScale(startTime) - 2).attr("width", timeTooltipGroup.select("text").node().getBoundingClientRect().width + 5);
            } else {
                timeTooltipGroup.selectAll(".endTime").style("display", "none");
            }
        } else {
            if (!d.length) {
                // Text
                showHideFullText(visible, ref);

                // De-highlight replicated events
                events.each(function(d2) {
                    if (d2.oID && d2.oID === d.oID && d2.id !== d.id) {
                        showHideFullText(false, d3.select(this).select(".sm-timeSets-svg-event-text").node());
                    }
                });
            }

            // Time
            timeTooltipGroup.style("display", "none");
        }
    }

    /**
     * Shows/Hides full text.
     */
    function showHideFullText(visible, ref) {
        if (!ref || !ref.parentNode || !ref.parentNode.parentNode || ref.clustered) {
            return;
        }

        if (visible) {
            d3.select(ref.parentNode).moveToFront();
            d3.select(ref.parentNode).select(".sm-timeSets-svg-event-selection-text").style("display", "block");
            d3.select(ref.parentNode).select(".sm-timeSets-svg-event-selection").style("display", "block")
                .attr("width", function() { return d3.select(ref.parentNode).select(".sm-timeSets-svg-event-selection-text").node().getComputedTextLength() + 5; });
            d3.select(ref).style("opacity", 0);
        } else {
            d3.select(ref.parentNode).select(".sm-timeSets-svg-event-selection-text").style("display", "none");
            d3.select(ref.parentNode).select(".sm-timeSets-svg-event-selection").style("display", "none");
            d3.select(ref).style("opacity", ref.__data__.trust);
        }
    }

    /**
     * De-highlights events.
     */
    function dehighlightEvents() {
        activeData.forEach(function(d) {
            d3.select(d.ref).select(".sm-timeSets-svg-event-text").style("opacity", d.trust).style("font-weight", "normal");
        });

        outlineBorderGroup.selectAll("path").style("display", "none");
    }

    // /**
    //  * Highlight all events in the given layer.
    //  */
    // function highlightLayer(layerId) {
    //     if (setMode === "path") {
    //         if (layerId % 2 === 0) {
    //             var fullLayerIndex = getFullLayerIndex(layerId / 2);
    //             highlightPathBorder(layerId);
    //         } else {
    //             var idx1 = getFullLayerIndex((layerId + 1) / 2);
    //             var idx2 = getFullLayerIndex((layerId - 1) / 2);
    //             highlightPathBorders(idx1, idx2);
    //         }
    //     }
    // }

    /**
     * Get the index of full layer (not consider filtering).
     */
    function getFullLayerIndex(layerIndex) {
        var start = -1;
        for (var i = 0; i < numThemes; i++) {
            if (activeThemeIds[orderToId[i]]) {
                start++;

                if (start === layerIndex) {
                    return i;
                }
            }
        }
    }

    // /**
    //  * Highlight the border of the path.
    //  */
    // function highlightPathBorder(index) {
    //     outlineBorderGroup.selectAll("path").style("display", "none");
    //     outlineBorderGroup.select("[id=path-border" + index + "]").style("display", "block");
    //     legend.highlightRow(numThemes - index - 1);
    // }

    // /**
    //  * Highlight the border of the path.
    //  */
    // function highlightPathBorders(index1, index2) {
    //     outlineBorderGroup.selectAll("path").style("display", "none");
    //     outlineBorderGroup.select("[id=path-border" + index1 + "]").style("display", "block");
    //     outlineBorderGroup.select("[id=path-border" + index2 + "]").style("display", "block");
    //     legend.highlightRows([numThemes - index1 - 1, numThemes - index2 - 1]);
    // }

    // /**
    //  * Highlight all events having the given theme.
    //  */
    // function highlightTheme(fullLayerIndex) {
    //     activeData.forEach(function(d) {
    //         var alpha;
    //         var notChanged = false;
    //         if (applyLayout) {
    //             var themeId = orderToId[fullLayerIndex];
    //             // Find real layer index, which takes into account filtering
    //             if (!activeThemeIds[themeId]) {
    //                 notChanged = true;
    //             } else {
    //                 var realIndex = fullLayerIndex;
    //                 for (var i = fullLayerIndex - 1; i >= 0; i--) {
    //                     if (!activeThemeIds[orderToId[i]]) {
    //                         realIndex--;
    //                     }
    //                 }

    //                 alpha = (d.layer === realIndex * 2 - 1 || d.layer === realIndex * 2 || d.layer === realIndex * 2 + 1) ? 1 : 0.3;
    //             }
    //         } else {
    //             alpha = d.themeIds.indexOf(fullLayerIndex) !== -1 ? 1 : 0.3;
    //         }
    //         if (!notChanged) {
    //             var fontWeight = alpha === 1 ? "bold" : "normal";
    //             d3.select(d.ref).select(".sm-timeSets-svg-event-text").style("opacity", alpha).style("font-weight", fontWeight);
    //         }
    //     });
    // }

    /**
     * Computes location for themes and events.
     */
    function computeLayout(transitionDuration) {
        // Remove all clusters
        clusterGroup.selectAll("g").remove();

        // Reset
        activeData.forEach(function(d) {
            d.originalTranslate = null;
            d.level = undefined;
        });

        if (!applyLayout) {
            computeLayerLayout(0, maxLevel, 0);
        } else {
            // Compute layer heights to maximise readability and balance between layers
            // Start with proportional height but adjusted after each layer is laid out
            assignedLayers = new Array(numLayers);

            initLayout();

            updateEventBoundaries();

            if (balancingMode) {
                balanceLayers();
            }
            if (compactingMode) {
                compactAndReuseLayers();
            }
        }

        // Layout for non-set events
        if (showNonSetEvents) {
            var startTime = new Date();
            computeNonSetEventsLayout();
            console.log("Time for non-set layout " + new Date() - startTime);
        }

        // Translate to new level
        events.each(function(d) {
            translateEvent(d, d.cluster ? 0 : transitionDuration);
        });

        // Draw outlines
        drawSets();
    }

    /**
     * Computes location for events in a layer.
     */
    function computeLayerLayout(startLevel, endLevel, layerId) {
        // Remove cluster
        clusterGroup.selectAll("g").each(function(d) {
            if (d[0].layer === layerId) {
                d3.select(this).remove();
            }
        });

        // Recover trimmed text
        events.each(function(d) {
            if (d.layer === layerId) {
                d3.select(this).select(".sm-timeSets-svg-event-text").text(d.title);
            }
        });

        var rightmostEvents = {};
        var extremeLevels = { low: 0, high: 0 };
        var prevEvent = null;

        events.each(function(d) {
            if (d.hasSet && (!applyLayout || d.layer === layerId)) {
                d.prevDir = null;
                prevEvent = layoutMode === "middle" ? computeEventLayoutMiddle(d, this, startLevel, endLevel, prevEvent, rightmostEvents, extremeLevels)
                                                    : computeEventLayoutBottom(d, this, startLevel, endLevel, prevEvent, rightmostEvents, extremeLevels);
            }
        });

        // Trim last events in each rows
        trimLastEvents(rightmostEvents);

        // Translate to the startLevel
        if (layoutMode === "middle") {
            var offset = startLevel - extremeLevels.low;
            events.each(function(d) {
                if (!applyLayout || d.layer === layerId) {
                    d.level += offset;
                }
            });

            return extremeLevels.high + offset;
        }

        return extremeLevels.high;
    }

    /**
     * Layout for events which don't belong to any sets.
     */
    function computeNonSetEventsLayout() {
        // TODO: Only support 'background' mode
        if (setMode !== "background") { return; }

        nonSetData.forEach(function(d) { d.level = undefined; });
        var count = 0;
        var numTests = 412;
        var prevEvent = null;

        events.each(function(d) {
            if (d.hasSet) { return; }

            if (count < numTests) {
                prevEvent = computeNonSetSingleEvent(d, this, prevEvent);
                count++;
            }
        });
    }

    function computeNonSetSingleEvent(event, self, prevEvent) {
        // Assign left, right to the event
        initEventLocation(event, self);

        // In each row, store an array of occupied rectangles
        var occupiedRows = [];
        for (var i = 0; i < maxLevel; i++) {
            occupiedRows.push([]);
        }

        // Initialize it by copying extreme rects of all outlines
        var shapeOutlines = getShapeOutlinesForCloseSets();

        for (var i = 0; i < shapeOutlines.length; i++) {
            var rects = shapeOutlines[i].outline.getExtremeRects();
            var eventRects = shapeOutlines[i].outline.rects();

            for (var j = 0; j < rects.length; j++) {
                if (rects[j]) {
                    occupiedRows[rects[j].level].push(rects[j]);
                    // Assign events to extreme rects so that we know which events inside it
                    rects[j].dataEvents = eventRects.filter(function(d) { return d.level === rects[j].level; }).sort(function(a, b) { return a.left > b.left; });
                }
            }
        }

        // Add placed non-set events
        for (var i = 0; i < nonSetData.length; i++) {
            var placedEvent = nonSetData[i];
            if (placedEvent.level !== undefined && placedEvent.ref) {
                occupiedRows[placedEvent.level].push(placedEvent);
            }
        }

        // Add clusters: TODO: if clusters are bands, no need for this separate addition
        events.each(function(d) {
            if (d.hasSet && d.cluster) {
                occupiedRows[d.level].push(d);
            }
        });

        // Make rects in it row follow ascending order
        occupiedRows.forEach(function(r) {
            r.sort(function(a, b) { return a.left > b.left; });
        });

        // Try trim a bit for better layout (trimThresholdRatio)
        if (!tryUpwards(true, event, occupiedRows)) {
            // If fail, trim until limit (minEventWidth)
            if (!tryUpwards(false, event, occupiedRows)) {
                // Need to aggregate to the previous event
                if (prevEvent) {
                    return aggregateEvents(event, self, prevEvent);
                } else { // This is the first event, no event to aggregate into, put it in the top level, where it can has more space
                    trimText(event, minEventWidth);
                    event.level = maxLevel - 1;
                    event.trimmed = true;
                }
            }
        }

        return event;
    }

    /**
     * Layout for non-set events.
     * Test from the bottom to the top.
     */
    function tryUpwards(forLayout, event, occupiedRows) {
        // Try to stay in the lowest level, trim itself or other events if needed
        for (var i = 0; i < maxLevel; i++) {
            event.level = i;
            var row = occupiedRows[i];

            // Find the first and the second overlapping rect in the row.
            // Type 1 of first contact (only one contact): the event is lefter -> trim the event at first_contact.left
            // Type 2 of first contact: fc is lefter -> trim the first contact at event.left, and trim the event at second_contact.left

            // Find contacts
            var firstContact = null, secondContact = null;
            var type1 = false;

            for (var j = 0; j < row.length; j++) {
                if (event.left < row[j].left && event.right > row[j].left) { // Type 1 - Overlapping
                    if (!firstContact) {
                        firstContact = row[j];
                        type1 = true;
                        break;
                    } else if (!secondContact) {
                        secondContact = row[j];
                        break;
                    }
                }

                if (event.left >= row[j].left && event.left < row[j].right) { // Type 2 - Overlapping
                    if (!firstContact) {
                        firstContact = row[j];
                    } else if (!secondContact) {
                        secondContact = row[j];
                        break;
                    } else {
                        break;
                    }
                }
            }

            // Trim if overlap
            if (firstContact) {
                // Type 2: The last event inside first contact is the one needs to be trimmed
                var trimEvent = type1 ? event : (firstContact.dataEvents ? firstContact.dataEvents[firstContact.dataEvents.length - 1] : firstContact);
                var trimAt = (type1 ? firstContact.left : event.left);
                var remainingTextWidth = isTrimmable(trimEvent, trimAt, type1 ? forLayout : true); // High priority for set events, always 'true' forLayout
                if (remainingTextWidth) { // Can trim, but still need to look at second contact
                    if (secondContact) {
                        var remainingTextWidth2 = isTrimmable(event, secondContact.left, forLayout);
                        if (remainingTextWidth2) { // Can trim both, do it
                            trimText(trimEvent, remainingTextWidth);
                            trimEvent.trimmed = true;
                            trimText(event, remainingTextWidth2);
                            event.trimmed = true;

                            return true;
                        }
                    } else {
                        trimText(trimEvent, remainingTextWidth);
                        trimEvent.trimmed = true;

                        return true;
                    }
                }
            } else {
                event.full = true;

                return true;
            }
        }

        return false;
    }

    function initEventLocation(d, self) {
        d3.select(self).style("opacity", 1);

        // Save the original position for transition effect
        var t = d3.transform(d3.select(self).attr("transform")).translate;
        if (!d.originalTranslate) { // Need to check because it can be run many times to find the best layout
            d.originalTranslate = t;
        }

        // Find the display boundary of the event
        d3.select(self).attr("transform", function(d) { return "translate(" + xScale(d.time) + ", 0)"; });
        var location = self.getBoundingClientRect();

        d.ref = self;
        d.left = location.left - LEGIBILITY_PADDING; // Give a padding between text and border
        d.right = location.right + LEGIBILITY_PADDING;
        d.full = d.trimmed = d.cluster = false;
    }

    function initLayout() {
        var numAvailableLevels = maxLevel;
        var numNotProcessedLayers = 0;
        for (var i = 0; i < numLayers; i++) {
            if (layerEvents[i].length > 0) {
                numNotProcessedLayers++;
            }
        }
        numAvailableLevels = Math.max(numNotProcessedLayers, numAvailableLevels);

        // Arrange events in each layer by applying events-only layout
        var highestLevel = 0;
        for (var i = 0; i < numLayers; i++) {
            if (layerEvents[i].length === 0) {
                continue;
            }

            // Find proportional height
            var heightOfNotProcessedLayers = 0;
            for (var j = i; j < numLayers; j++) {
                heightOfNotProcessedLayers += layerEvents[j].length;
            }
            var layerHeight = Math.max(1, Math.round(layerEvents[i].length / heightOfNotProcessedLayers * numAvailableLevels));

            // Adjust if there is not enough at least one level for the rest layers
            numNotProcessedLayers--;
            if (numAvailableLevels - layerHeight < numNotProcessedLayers) {
                layerHeight--;
            }

            var startLevel = highestLevel;
            var endLevel = startLevel + layerHeight;
            highestLevel = computeLayerLayout(startLevel, endLevel, i) + 1;

            numAvailableLevels -= (highestLevel - startLevel);
            assignedLayers[i] =  { index: i };
            assignedLayers[i].ratio = computeLegibilityRatio(i);
            assignedLayers[i].startLevel = startLevel;
            assignedLayers[i].endLevel = highestLevel;
        }

        updateEventBoundaries();

        // Reuse available levels: it could happen when the last layer doesn't use all allocated levels
        reuseAvailableRows(numAvailableLevels);
    }

    /**
     * Incrementally improve the layout legibility.
     */
    function balanceLayers() {
        if (assignedLayers.every(function(d) { return d.ratio === 1; })) {
            return;
        }

        var startTime = (new Date()).getTime();

        // Exclude layers which have ratio = 1 and layer height = 1
        var validLayers = [];
        for (var i = 0; i < numLayers; i++) {
            if (layerEvents[i].length === 0 || (assignedLayers[i].ratio === 1 && (assignedLayers[i].endLevel - assignedLayers[i].startLevel === 1))) {
                continue;
            }

            validLayers.push(assignedLayers[i]);
        }

        // Sorted by distance between pairs, and pick the longest one first
        var unAdjustedPairs = [];
        for (var i = 0; i < validLayers.length; i++) {
            for (var j = i + 1; j < validLayers.length; j++) {
                unAdjustedPairs.push(validLayers[i].index + "#" + validLayers[j].index);
            }
        }

        var distance = function(key) {
            var tokens = key.split("#");
            var ratio1 = assignedLayers[+tokens[0]].ratio;
            var ratio2 = assignedLayers[+tokens[1]].ratio;
            return Math.abs(ratio1 - ratio2);
        };

        var bestDev = computeLegibilityRatioDeviation();

        while ((new Date()).getTime() - startTime < maxOptimizationTime && unAdjustedPairs.length > 0) {
            unAdjustedPairs.sort(function(a, b) {
                return d3.descending(distance(a), distance(b));
            });

            var longestPair = unAdjustedPairs[0];
            var tokens = longestPair.split("#");
            bestDev = balanceTwoLayers(bestDev, +tokens[0], +tokens[1]);
            unAdjustedPairs.shift();
        }
    }

    function compactAndReuseLayers() {
        while (compactLayers()) {
            // Find the lowest legibility ratio to give an additional roww
            var lowestRatio = 1, idx = -1;
            for (var i = 0; i < numLayers; i++) {
                if (assignedLayers[i] && !assignedLayers[i].alreadyMaxRatio && assignedLayers[i].ratio < lowestRatio) {
                    lowestRatio = assignedLayers[i].ratio;
                    idx = i;
                }
            }

            if (idx === -1) { return; }

            var highestLevel = 0;

            for (var i = 0; i < numLayers; i++) {
                if (!assignedLayers[i]) { continue; }

                // Plus one height for the lowest, same for others
                var layerHeight = assignedLayers[i].endLevel - assignedLayers[i].startLevel;
                if (i === idx) {
                    layerHeight++;
                }

                var startLevel = highestLevel;
                var endLevel = startLevel + layerHeight;
                highestLevel = computeLayerLayout(startLevel, endLevel, i) + 1;

                var newRatio = computeLegibilityRatio(i);
                assignedLayers[i].alreadyMaxRatio = assignedLayers[i].ratio === newRatio; // Traceability algorithm doesn't always give ratio 1
                assignedLayers[i].ratio = newRatio;
                assignedLayers[i].startLevel = startLevel;
                assignedLayers[i].endLevel = highestLevel;
            }
        }
    }

    /**
     * Distribute available rows to layers.
     */
    function reuseAvailableRows(numAvailableLevels) {
        while (numAvailableLevels > 0) {
            var adjusted = false;

            for (var i = 0; i < numLayers; i++) {
                if (layerEvents[i].length === 0 || assignedLayers[i].ratio === 1) {
                    continue;
                }

                adjusted = adjustLayerHeight(i, 1);
                if (adjusted) {
                    numAvailableLevels--;

                    if (!numAvailableLevels) {
                        break;
                    }
                }
            }

            if (!adjusted) {
                break;
            }
        }
    }

    function getShapeOutlineForLayer(layerIndex) {
        var source = layerIndex === -1 ? activeData : layerEvents[layerIndex];
        if (!source.length) {
            return null;
        }

        var rects = source.filter(function(d) { return d.ref; });
        var shapeOutline = sm.layout.timesetsOutline().rects(rects).verticalMode(verticalMode).fillHorizontalGap(intersectionMode.substring(0, 8) === "gradient");
        shapeOutline.call();

        return shapeOutline;
    }

    /**
     * Moves each layer up until overlap.
     */
    function compactLayers() {
        updateEventBoundaries();

        var extremeRects = new Array(numLayers);
        for (var i = 0; i < numLayers; i++) {
            var shapeOutline = getShapeOutlineForLayer(i);
            if (shapeOutline) {
                extremeRects[i] = shapeOutline.getExtremeRects();
            }
        }

        var beforeHeight = d3.max(assignedLayers, function(d) { return d ? d.endLevel : 0; });

        for (var i = 1; i < numLayers; i++) {
            if (!assignedLayers[i]) {
                continue;
            }

            // Check if a layer can freely move. It depends on whether it is a shared layer
            var free = true;
            if (i % 2) { // Shared, check with 2 above and 2 below. If exist one, not free
                if (assignedLayers[i - 2] || assignedLayers[i - 1] || assignedLayers[i + 1] || assignedLayers[i + 2]) {
                    free = false;
                }
            } else { // Not shared, check with 1 above and 1 below.
                if (assignedLayers[i - 1] || assignedLayers[i + 1]) {
                    free = false;
                }
            }

            var offset = assignedLayers[i].startLevel;
            if (free) { // Move from the bottom of the display upwards, stop at when it fits
                for (var j = offset; j > 0; j--) {
                    var intersected = false;
                    for (var k = 0; k < i; k++) { // Test with every other which is placed
                        if (isIntersected(extremeRects[k], extremeRects[i], j)) {
                            intersected = true;
                            break;
                        }
                    }

                    if (!intersected) {
                        // Stay here, update
                        layerEvents[i].forEach(function(d) {
                            d.level -= j;
                        });

                        assignedLayers[i].startLevel -= j;
                        assignedLayers[i].endLevel -= j;

                        for (var r = 0; r < extremeRects[i].length; r++) {
                            if (extremeRects[i][r]) {
                                extremeRects[i][r - j] = extremeRects[i][r];
                            }
                        }
                        for (var r = extremeRects[i].length - j; r < extremeRects[i].length; r++) {
                            extremeRects[i][r] = null;
                        }

                        break;
                    }
                }
            } else {
                var endLevel;

                // This layer and the previous layer should have at least one row in common
                for (var j = i - 1; j >= 0; j--) {
                    if (assignedLayers[j]) {
                        endLevel = assignedLayers[j].startLevel + 1;
                        break;
                    }
                }

                var numOfSteps = assignedLayers[i].endLevel - endLevel - 1;

                // Non-shared layer: start level can't go beyond end level of the layer below the shared layer to make sure set[i] and set[i-2] have no intersection
                if (i % 2 === 0 && assignedLayers[i - 3]) {
                    var startLevel = assignedLayers[i - 3].endLevel + 1;
                    numOfSteps = Math.min(numOfSteps, assignedLayers[i].startLevel - startLevel);
                }

                var lastFit;

                // Try to move down each step
                var intersectedLayer = -1;
                for (var j = 1; j <= numOfSteps; j++) {
                    for (var k = 0; k < i; k++) { // Test with every other which is placed
                        if (isIntersected(extremeRects[k], extremeRects[i], j)) {
                            intersectedLayer = k;
                            break;
                        }
                    }

                    if (intersectedLayer !== -1) { // If intersected, cant try any more
                        // If two shared layers intersected, take event one step back to show the intersection easier
                        if (i % 2 && intersectedLayer % 2) {
                            lastFit--;
                        }
                        break;
                    } else {
                        lastFit = j;
                    }
                }

                if (lastFit) {
                    layerEvents[i].forEach(function(d) {
                        d.level -= lastFit;
                    });

                    assignedLayers[i].startLevel -= lastFit;
                    assignedLayers[i].endLevel -= lastFit;

                    for (var r = 0; r < extremeRects[i].length; r++) {
                        if (extremeRects[i][r]) {
                            extremeRects[i][r - lastFit] = extremeRects[i][r];
                        }
                    }
                    for (var r = extremeRects[i].length - lastFit; r < extremeRects[i].length; r++) {
                        extremeRects[i][r] = null;
                    }
                }
            }
        }

        var afterHeight = d3.max(assignedLayers, function(d) { return d ? d.endLevel : 0; });
        return (afterHeight < beforeHeight && afterHeight < maxLevel);
    }

    function isIntersected(e1, e2, rightOffset) {
        if (!e1 || !e2) {
            return false;
        }

        for (var i = 0; i < e1.length; i++) {
            if (!isSeparate(e1[i], e2[i + rightOffset])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Layout the given event from the middle.
     */
    function computeEventLayoutMiddle(d, self, startLevel, endLevel, prevEvent, rightmostEvents, extremeLevels) {
        initEventLocation(d, self);

        // 1. Start from the same level as the previous event. If intersection, try to trim for better layout.
        // If cant trim, moves up or down and checks again.
        var prevLevel = prevEvent ? prevEvent.level : 0;
        if (canStayInTheLevel(true, d, prevLevel, prevLevel, rightmostEvents, extremeLevels)) {
            d.dir = "right";
            return d;
        }

        // 2. Go up/down without trimming
        var upLevel = prevLevel + 1;
        var downLevel = prevLevel - 1;
        var height = endLevel - startLevel;
        var upLimit = height + extremeLevels.low - 1;
        var downLimit = extremeLevels.high + 1 - height;
        var canGoUp = upLevel <= upLimit;
        var canGoDown = downLevel >= downLimit;
        var firstTry = secondTry = -1;
        var needToAggregate = false;

        if (canGoUp && canGoDown) { // If both directions have spare space, keep following the previous direction
            if (prevEvent.dir === "up") {
                d.dir = "up";
                firstTry = upLevel;
                secondTry = downLevel;
            } else if (prevEvent.dir === "down") {
                d.dir = "down";
                firstTry = downLevel;
                secondTry = upLevel;
            } else { // Right: choose the direction that has more space to go
                var upSpace = upLimit - upLevel;
                var downSpace = downLevel - downLimit;
                if (upSpace >= downSpace) {
                    d.dir = "up";
                    firstTry = upLevel;
                    secondTry = downLevel;
                } else {
                    d.dir = "down";
                    firstTry = downLevel;
                    secondTry = upLevel;
                }
            }
        } else if (canGoUp) { // Only go up
            firstTry = upLevel;
        } else if (canGoDown) { // Only go down
            firstTry = downLevel;
        } else { // 3. Need to aggregate
            needToAggregate = true;
        }

        if (!needToAggregate) {
            // Without trimming
            if (canStayInTheLevel(true, d, prevLevel, firstTry, rightmostEvents, extremeLevels)) {
                return d;
            }
            if (secondTry !== -1) {
                if (canStayInTheLevel(true, d, prevLevel, secondTry, rightmostEvents, extremeLevels)) {
                    return d;
                }
            }

            if (canStayInTheLevel(false, d, prevLevel, prevLevel, rightmostEvents, extremeLevels)) {
                d.dir = "right";
                return d;
            }

            // With trimming
            if (canStayInTheLevel(false, d, prevLevel, firstTry, rightmostEvents, extremeLevels)) {
                return d;
            }
            if (secondTry !== -1) {
                if (canStayInTheLevel(false, d, prevLevel, secondTry, rightmostEvents, extremeLevels)) {
                    return d;
                }
            }
        }

        // 3. Final step: need to aggregate events
        // The previous event is the closest and worst in terms of remaining text, pick it.
        // If the picked event is a cluster, join it. Otherwise, create a new one with it.
        return aggregateEvents(d, self, prevEvent);
    }

    /**
     * Checks if the given event can stay in the given level.
     */
    function canStayInTheLevel(forLayout, event, prevLevel, level, rightmostEvents, extremeLevels) {
        // Can stay without trimming?
        if (!isSeparate(event, rightmostEvents[level])) {
            if (usePicture) {
                return false;
            }

            // Need trimming
            var remainingTextWidth = isTrimmable(rightmostEvents[level], event.left - LEGIBILITY_PADDING * 2, forLayout);
            if (!remainingTextWidth) {
                return false;
            }

            trimText(rightmostEvents[level], remainingTextWidth);
            rightmostEvents[level].trimmed = true;
            rightmostEvents[level].full = false;
        }

        // Update
        rightmostEvents[level] = event;
        extremeLevels.low = Math.min(extremeLevels.low, level);
        extremeLevels.high = Math.max(extremeLevels.high, level);
        event.level = level;
        event.full = true;

        return true;
    }

    /**
     * Layout the given event from the bottom.
     */
    function computeEventLayoutBottom(d, self, startLevel, endLevel, prevEvent, rightmostEvents, extremeLevels) {
        initEventLocation(d, self);

        // 1. Start from the bottom, if the event intersects with all rightmost events of occupied levels, place it in the new level.
        // Otherwise, place it in the closest non-intersected level.
        for (var testLevel = startLevel; testLevel < endLevel; testLevel++) {
            // Check with the rightmost event in this test level
            if (!rightmostEvents[testLevel] || isSeparate(d, rightmostEvents[testLevel])) {
                rightmostEvents[testLevel] = d;
                extremeLevels.high = Math.max(extremeLevels.high, testLevel);
                d.level = testLevel;
                d.full = true;

                return d;
            }
        }

        // 2. Reach the limit of level, need to trim some existing event
        // Find the best one to trim. My definition of the best one: longest remaining text width. It is one of the rightmost events.
        var theBestLevel = -1;
        var bestRemainingTextWidth = 0;
        for (var testLevel = startLevel; testLevel < endLevel; testLevel++) {
            var remainingTextWidth = isTrimmable(rightmostEvents[testLevel], d.left - LEGIBILITY_PADDING * 2);
            if (!remainingTextWidth) {
                continue;
            }

            // Find the best one
            if (bestRemainingTextWidth < remainingTextWidth) {
                theBestLevel = testLevel;
                bestRemainingTextWidth = remainingTextWidth;
            }
        }

        if (theBestLevel !== -1) { // Find the one to trim
            trimText(rightmostEvents[theBestLevel], bestRemainingTextWidth);
            rightmostEvents[theBestLevel] = d;
            extremeLevels.high = Math.max(extremeLevels.high, theBestLevel);
            d.level = theBestLevel;
            d.trimmed = true;

            return d;
        }

        // 3. Final step: need to aggregate events
        // The previous event is the closest and worst in terms of remaining text, pick it.
        // If the picked event is a cluster, join it. Otherwise, create a new one with it.
        return aggregateEvents(d, self, prevEvent);
    }

    function aggregateEvents(d, self, prevEvent) {
        d.dir = "right";
        var ref = d3.select(prevEvent.ref);
        if (prevEvent.cluster) {
            ref.data()[0].push(d);
            updateCluster(ref, ref.data()[0]);
        } else {
            // Remove the previous event
            ref.style("opacity", 0);

            // It's cluster now
            prevEvent.cluster = true;
            prevEvent.full = prevEvent.trimmed = false;
            prevEvent.ref = createNewCluster([prevEvent, d]);
        }

        // Update boundary of the cluster
        var location = prevEvent.ref.getBoundingClientRect();
        prevEvent.left = location.left - LEGIBILITY_PADDING;
        prevEvent.right = location.right + LEGIBILITY_PADDING;

        // Remove this individual
        d.ref = null;
        d3.select(self).style("opacity", 0);

        return prevEvent;
    }

    /**
     * Checks whether the given event can be trimmed.
     */
    function isTrimmable(event, trimAt, forLayout) {
        if (!event) {
            return true;
        }

        // Can't trim cluster
        if (event.cluster) {
            return false;
        }

        var node = d3.select(event.ref).select(".sm-timeSets-svg-event-text").node();
        if (!node) {
            return false;
        }

        // Can't trim if violate text width condition
        var myTextWidth = node.getBoundingClientRect().width;
        var trimmedTextWidth = event.right - LEGIBILITY_PADDING - trimAt;
        var remainingTextWidth = myTextWidth - trimmedTextWidth;

        // Let only trimThresholdRatio control
        if (remainingTextWidth < minEventWidth) {
            return false;
        }

        // Additional constraint if trimming for layout
        if (forLayout) {
            // Can't trim if violate ratio condition
            var trimRatio = trimmedTextWidth / myTextWidth;
            trimRatio = Math.min(trimRatio, 1); // trimmedTextWidth can be negative and this ratio > 1
            if (trimRatio > 1 - trimThresholdRatio) {
                return false;
            }
        }

        return remainingTextWidth;
    }

    /**
     * Trim text of an event by given width.
     */
    function trimText(eventData, width) {
        var textElement = d3.select(eventData.ref).select(".sm-timeSets-svg-event-text").node();

        // Ignore last ...
        var numChars = textElement.getNumberOfChars();
        textElement.textContent += "...";
        var dotsWidth = textElement.getSubStringLength(numChars, 3);
        width -= dotsWidth - 10; // - 10 there's a bit space left

        // Find the limit position
        var limitPosition = 0;
        if (width > 0) {
            var changed = false;
            for (var i = 0; i < numChars; i++) {
                var w = textElement.getSubStringLength(0, i + 1);
                if (w === textElement.getSubStringLength(0, i) || w > width) { // Somehow getSubStringLength doesn't increase after a number of chars
                    limitPosition = i;
                    changed = true;
                    break;
                }
            }

            // Shouldn't happen
            if (!changed) {
                console.log("No need to trim this event: " + eventData);
                limitPosition = numChars + 1;
            }
        }

        textElement.textContent = textElement.textContent.substring(0, limitPosition) + (limitPosition === numChars + 1 ? "" : "...");
        eventData.right = textElement.getBoundingClientRect().right + LEGIBILITY_PADDING;
    }

    /**
     * Creates a new cluster.
     */
    function createNewCluster(theData) {
        var cluster = clusterGroup.append("g").datum(theData)
            .attr("transform", function() { return "translate(" + xScale(theData[0].time) + ", 0)"; });

        // - Rectangle
        var rect = cluster.append("rect")
            .classed("sm-timeSets-svg-cluster-rect", true)
            .attr("x", 0)
            .attr("y", -CLUSTER_HEIGHT / 2)
            .attr("height", CLUSTER_HEIGHT)
            .attr("stroke", function(d) { return d[0].hasSet ? "#5F92B0" : "#5F92B0"; }) // The first value should be 'dotColor' for hasSet, not correct aggregate yet
            .attr("fill", function(d) { return d[0].hasSet ? "none" : "#BFEFFC"; });

        // - Text
        var text = "2 events";
        var textElement = cluster.append("text")
            .classed("sm-timeSets-svg-event-text", true)
            .text(text)
            .attr("x", 5)
            .attr("dy", EVENT_TEXT_DY) // 9 for 26px level-height
            .on("mouseover", function(d) {
                showHideTooltip(true, this, d);

                if (setMode === "background") { return; }

                d3.select(d3.select(this).node().parentNode).select(".sm-timeSets-svg-cluster-rect").style("fill", "#BFEFFC").style("stroke", "#5F92B0");
                // highlightLayer(d[0].layer);
            })
            .on("mouseout", function(d) {
                // d3.select(d3.select(this).node().parentNode).select(".sm-timeSets-svg-cluster-rect").style("fill", null).style("stroke", "none");
                dehighlightEvents();
                legend.dehighlightRows();
                showHideTooltip(false, this, d);

                if (setMode === "background") { return; }

                d3.select(d3.select(this).node().parentNode).select(".sm-timeSets-svg-cluster-rect").style("fill", null).style("stroke", "white");
            })
            .on("click", function(d) {
                d.x = d3.event.pageX;
                d.y = d3.event.pageY + 25;
                d.dialogTitle = d3.select(this).text();
                d3.select(this).call(eventViewer).call(trustViewer);  // Always show all events
            });

        rect.attr("width", textElement.node().getComputedTextLength() + 10);

        // Update time bar for cluster
        var startTime = xScale(theData[0].time);
        var endTime = startTime;
        theData.forEach(function(d) {
            endTime = Math.max(endTime, xScale(d.time));
            if (d.endTime) {
                endTime = Math.max(endTime, xScale(d.endTime));
            }
        });

        cluster.append("rect")
            .classed("sm-timeSets-svg-cluster-bar", true)
            .attr("x", 0)
            .attr("y", -CLUSTER_HEIGHT / 2 - TIME_BAR_HEIGHT + 5)
            .attr("width", endTime - startTime)
            .attr("height", TIME_BAR_HEIGHT)
            .attr("fill", function(d) { return d[0].hasSet && applyLayout ? dotColor : "steelblue"; });
            // .style("fill-opacity", 0.5);

        return cluster.node();
    }

    /**
     * Updates an exisiting cluster with new data.
     */
    function updateCluster(cluster, theData) {
        var text = theData.length + " events";
        cluster.select("text").text(text);
        cluster.select(".sm-timeSets-svg-cluster-rect").attr("width", cluster.select("text").node().getComputedTextLength() + 10);

        var startTime = xScale(theData[0].time);
        var endTime = startTime;
        theData.forEach(function(d) {
            endTime = Math.max(endTime, xScale(d.time));
            if (d.endTime) {
                endTime = Math.max(endTime, xScale(d.endTime));
            }
        });

        cluster.append("rect.sm-timeSets-svg-cluster-bar")
            .attr("width", endTime - startTime);
    }

    /**
     * Returns y-position based on the given level. 0 is the bottom.
     */
    function yScale(level) {
        return -margin.bottom - 30 - (level + 0.5) * LEVEL_HEIGHT;
    }

    /**
     * Returns color used in themes.
     */
    function cScale(i) {
        if (!colors) {
            // Set 2 - colorbrewer
            colors = ["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"];
            // Change order to use brighter colors
            colors = ["#66c2a5","#8da0cb","#ffd92f","#e78ac3","#fc8d62","#a6d854","#e78ac3","#e5c494","#b3b3b3"];

            // Set 3 - colorbrewer
            // colors = ["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"];

            // d3 category10, excluding gray, adding yellow
            // colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#bcbd22", "#17becf", "ffff33"];
        }

        var c = sameOrderColor ? colors[idToOrder[i]] : colors[i];
        return d3.rgb(c).toString();
        // return d3.rgb(c).brighter(0.2).toString();
    }

    /**
     * Checks whether two given attentively allocated events are separate.
     */
    function isSeparate(e1, e2, mayDifferentLevels) {
        if (!e1 || !e2) { return true; }

        if (mayDifferentLevels && e1.level !== e2.level) { return true; }

        var extraPad = 0;
        return e1.right + extraPad < e2.left || e1.left > e2.right + extraPad;
    }

    /**
     * Sets unique id for data.
     */
    function setUniqueIds() {
        allData.forEach(function(d) {
            d.id = id++;
        });
    }

    /**
     * If event label is unnecessarily long ('alwaysTrim' attribute is true), trim it.
     */
    function forceTrimEvents() {
        allData.forEach(function(d) {
            d.originalTitle = d.title;
            if (d.alwaysTrim) {
                d.title = d.title.substring(0, MAX_NUM_CHARS) + (d.title.length <= MAX_NUM_CHARS ? "" : "...");
            }
        })
    }

    /**
     * Splits non-set events into a separate data structure for easy processing.
     */
    function splitNonSetEvents(init) {
        if (init) {
            allData = data;
            allData.forEach(function(d) {
                d.hasSet = d.themes && d.themes.length;
            });
        }

        nonSetData = allData.filter(function(d) { return !d.hasSet; });
        data = allData.filter(function(d) { return d.hasSet; });
    }

    function combineEvents() {
        allData = data.concat(nonSetData);
        allData.forEach(function(d) {
            d.hasSet = d.themes && d.themes.length;
        });

        allData.sort(function(a, b) {
            return d3.ascending(a.time, b.time);
        });
    }

    /**
     * Combines events with the same label together.
     */
    function aggregateSameLabelEvents(dataset) {
        if (aggregateLevel === "none" || !dataset || !dataset.length) { return []; }

        var updatePivotEvent = function (pivotEvent, event) {
            if (pivotEvent.aggregated) {
                pivotEvent.events.push(event);
            } else {
                pivotEvent.aggregated = true;
                pivotEvent.events = [pivotEvent, event];
            }
            pivotEvent.endTime = new Date(Math.max(pivotEvent.endTime || pivotEvent.time, event.endTime || event.time));
        };

        var newData = []; // New array of reference to original data
        if (aggregateLevel === "neighbor") {
            var pivotEvent = dataset[0]; // The event to compare with
            newData.push(pivotEvent);

            for (var i = 1; i < dataset.length; i++) {
                var event = dataset[i];
                if (event.title === pivotEvent.title) {
                    if (areTwoArrayEqual(event.themeIds, pivotEvent.themeIds)) { // Can only merge same-set events
                        updatePivotEvent(pivotEvent, event);
                    }
                } else {
                    newData.push(event);
                    pivotEvent = event;
                }
            }
        } else {
            for (var i = 0; i < dataset.length; i++) {
                var pivotEvent = dataset[i];

                // Already aggregated due to previous iteration
                if (pivotEvent.processed) { continue; }

                var finishAggregation = false;

                for (var j = i + 1; j < dataset.length; j++) {
                    var event = dataset[j];

                    // If different, it's a new subset. So end the aggregation if in 'subset' level.
                    if (areTwoArrayEqual(event.themeIds, pivotEvent.themeIds) || aggregateLevel === "set") {
                        if (event.title === pivotEvent.title) {
                            updatePivotEvent(pivotEvent, event);
                            event.processed = true;
                        }
                    } else {
                        newData.push(pivotEvent);
                        finishAggregation = true;
                        break;
                    }
                }

                // End of loop but not yet finish aggregation, typically in 'set' mode (need to check all events)
                if (!finishAggregation) {
                    newData.push(pivotEvent);
                }
            }
        }

        return newData;
    }

    function areTwoArrayEqual(array1, array2) {
        if (array1.length !== array2.length) { return false; }

        for (var i = 0; i < array1.length; i++) {
            if (array1[i] !== array2[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Rename same label events after adding parent events so that (x2) at the end of the title doesn't affect.
     * @return {[type]} [description]
     */
    function updateAggregatedLabels() {
        // Update aggregate event's title
        allData.forEach(function(d) {
            if (d.aggregated) {
                d.title = d.title + " (x" + d.events.length + ")";
                d.ogtitle = d.ogtitle + " (x" + d.events.length + ")";
            }
        });
    }

    /**
     * Adds new events from 'parent' attribute of events.
     */
    function addParentEvents() {
        // Only applied for set-events but need to traverse through 'allData' because new events will be added with fixed position.
        if (aggregateLevel === "none" || !allData || !allData.length) { return; }

        // Reset 'added', 'parented' attributes of previous calls
        allData.forEach(function(d) {
            d.added = d.parented = false;
        });

        var newData = []; // New array of reference to original data
        var parentIndex = 0;
        var pivotEvent = allData[0]; // The event to compare with
        newData.push(pivotEvent);

        var getCommonStart = function(s1, s2) {
            var n = Math.min(s1.length, s2.length);
            var i = 0;
            for (i; i < n; i++) {
                if (s1[i] !== s2[i]) {
                    break;
                }
            }

            return s1.substring(0, i);
        };

        var getCommonEnd = function(s1, s2) {
            var n = Math.min(s1.length, s2.length);
            var i = 0;
            for (i; i < n; i++) {
                if (s1[s1.length - 1 - i] !== s2[s2.length - 1 - i]) {
                    break;
                }
            }

            return s1.substring(s1.length - i);
        };

        // Initialize parent event
        var parentEvent = { "isParent": true, "hasSet": true, "themes": pivotEvent.themes, "themeIds": pivotEvent.themeIds, "time": pivotEvent.time, "events": [pivotEvent] };
        var lcsStart, lcsEnd;
        lcsStart = lcsEnd = pivotEvent.title;
        var hasCommonStart, hasCommonEnd;

        // Insert parent event to the begining of its children
        var insertParent = function() {
            if (parentEvent.events.length > 1) {
                newData.splice(parentIndex, 0, parentEvent);

                var parentTitle;

                // Add a marker to the begining of child events and trim common text
                parentEvent.events.forEach(function(d) {
                    var startIdx = hasCommonStart ? lcsStart.length : 0;
                    var endIdx = d.title.length - (hasCommonEnd ? lcsEnd.length : 0);
                    endIdx = Math.max(endIdx, startIdx); // Common start and common end can be overlapped
                    if (!parentTitle) {
                        parentTitle = d.title.substring(0, startIdx) + (startIdx > 0 ? " " : "") + d.title.substring(endIdx);
                    }
                    d.title = "___" + d.title.substring(startIdx, endIdx);
                });

                // Parent title is the combination if start and end common string
                parentEvent.title = parentEvent.originalTitle = parentTitle;
            }
        }

        var numChars = 7;

        for (var i = 1; i < allData.length; i++) {
            var event = allData[i];
            newData.push(event);

            if (!event.hasSet) { continue; }

            var commonStart = getCommonStart(event.title, lcsStart);
            var commonEnd = getCommonEnd(event.title, lcsEnd);
            var stopComparison = false;

            if (!hasCommonStart && !hasCommonEnd) { // Start checking common string
                hasCommonStart = commonStart.length > numChars;
                hasCommonEnd = commonEnd.length > numChars;
                lcsStart = hasCommonStart ? commonStart : "";
                lcsEnd = hasCommonEnd ? commonEnd : "";
                stopComparison = !hasCommonStart &&  !hasCommonEnd;
            } else { // Already has common string, need to match to follow
                lcsStart = commonStart.length > numChars ? commonStart : lcsStart;
                lcsEnd = commonEnd.length > numChars ? commonEnd : lcsEnd;
                stopComparison = hasCommonStart && commonStart.length <= numChars || hasCommonEnd && commonEnd.length <= numChars;
            }

            // Can only merge same-set events
            if (!stopComparison && areTwoArrayEqual(event.themeIds, pivotEvent.themeIds)) {
                parentEvent.events.push(event);
                parentEvent.endTime = new Date(Math.max(parentEvent.endTime || parentEvent.time, event.endTime || event.time));
            } else {
                insertParent();

                // Reset
                hasCommonStart = false;
                hasCommonEnd = false;
                pivotEvent = event;
                lcsStart = lcsEnd = pivotEvent.title;
                parentIndex = newData.length - 1;
                parentEvent = { "isParent": true, "hasSet": true, "themes" : pivotEvent.themes, "themeIds": pivotEvent.themeIds, "time": pivotEvent.time, "events": [pivotEvent] };
            }
        }

        // Incase vents at the end have common
        insertParent();

        allData = newData;
    }

    /**
     * Assign events into layers, non-neighbouring shared events will be replicated.
     * Run once with all data, not with active data so that event's layer isn't changed when zooming/panning.
     */
    function layeriseEvents() {
        // Reset
        data.forEach(function(d) {
            d.layers = [];
            d.oID = d.id;
        });

        if (!applyLayout) {
            return;
        }

        // Clone
        layerisedData = data.map(function(d) { return d; });

        var numActiveThemes = d3.sum(activeThemeIds, function(d) { return d ? 1 : 0; });
        numLayers = numActiveThemes === 0 ? 0 : numActiveThemes * 2 - 1;

        var processedEvents = new Array(layerisedData.length); // If events are processed, they will be replicated, if they can't share
        var replicateData = [];
        var idx = -1;

        for (var j = 0; j < numThemes; j++) {
            var themeId = orderToId[j];
            if (!activeThemeIds[themeId]) {
                continue;
            }

            idx++;

            layerisedData.forEach(function(d, i) {
                if (d.themeIds.indexOf(themeId) === -1) {
                    return true;
                }

                // If the event is not processed, simply assign it to the layer
                if (!processedEvents[i]) {
                    d.layers = [idx];
                    processedEvents[i] = true;
                    return true;
                }

                // Already processed, check if shared with the right below layer, inlcude the new layer to it. Otherwise, replicate the event with new layer.
                var belowThemeId = -1;
                for (var k = j - 1; k >= 0; k--) {
                    if (activeThemeIds[orderToId[k]]) {
                        belowThemeId = orderToId[k];
                        break;
                    }
                }

                if (d.themeIds.indexOf(belowThemeId) !== -1) {
                    if (d.layers.length === 1) { // Check if the event can be merged
                        if (d.layers[0] === idx - 1) { // Yes, it is the layer below
                            d.layers.push(idx);
                        } else { // No, need to find the event in the replicated data
                            replicateData.forEach(function(d2) {
                                if (d2.oID === d.oID && d2.layers.length === 1 && d2.layers[0] === idx - 1) {
                                    d2.layers.push(idx);
                                }
                            });
                        }
                    } else { // Need to replicate if this event is already merged. Cant share between 3 layers.
                        // Comment to not duplicate. For multi-set membership figure.
                        // replicateData.push({ time: d.time, id: id++, oID: d.id, title: d.title, content: d.content, code: d.code, themeIds: d.themeIds, layers: [idx - 1, idx] });
                    }
                } else {
                    var newItem = {
                        time: d.time,
                        id: id++,
                        oID: d.id,
                        title: d.title,
                        ogtitle: d.ogtitle,
                        originalTitle: d.originalTitle,
                        content: d.content,
                        sourceType: d.sourceType,
                        sourceImageUrl: d.sourceImageUrl,
                        confidence: d.confidence,
                        trust: d.trust,
                        relevance: d.relevance,
                        code: d.code,
                        themeIds: d.themeIds,
                        layers: [idx],
                        hasSet: true
                    };
                    replicateData.push(newItem);
                }
            });
        }

        // Join replicate data
        layerisedData = layerisedData.concat(replicateData);

        // Re-format layers if shared layers are treated explicitly
        layerisedData.forEach(function(d) {
            d.layer = d.layers.length === 1 ? d.layers[0] * 2 : d.layers[0] * 2 + 1;
            if (isNaN(d.layer)) {
                // console.log(d);
            }
        });

        // Sort data by time ascendingly for easy computing layout
        layerisedData.sort(function(a, b) {
            if (a.time.getTime() === b.time.getTime()) {
                return d3.ascending(a.title.length, b.title.length);
            }

            return d3.ascending(a.time, b.time);
        });
    }

    /**
     * Find theme ordering to maximise the number of shared events between neighbouring themes using brute-force algorithm
     */
    function computeThemeOrderingBruteForce() {
        // Build shared events graph (undirected): vertex is theme, edge is num of shared events between themes
        // - Table of shared events
        var table = new Array(numThemes);
        for (var i = 0; i < numThemes; i++) {
            table[i] = new Array(numThemes);
            for (var j = 0; j < numThemes; j++) {
                table[i][j] = 0;
            }
        }

        // - Fill the table
        data.forEach(function(d) {
            if (d.themeIds.length === 2) {
                table[d.themeIds[0]][d.themeIds[1]]++;
                table[d.themeIds[1]][d.themeIds[0]]++;
            }
        });

        // Brute-force loop: n! with n is the number of themes
        var values = new Array(numThemes);
        var longestPathValue = -1,
            longestPath;

        function solve(values, k) {
            if (k === numThemes - 1) {
                var sum = 0;
                for (var i = 0; i < numThemes - 1; i++) {
                    sum += table[values[i]][values[i + 1]];
                }
                if (sum > longestPathValue) {
                    longestPathValue = sum;
                    longestPath = values.map(function(d) { return d; });
                }
            } else {
                k++;

                // Go through all possible solutions for k-th position
                for (var i = 0; i < numThemes; i++) {
                    var existed = false;
                    for (var j = 0; j < k; j++) {
                        if (values[j] === i) {
                            existed = true;
                            break;
                        }
                    }

                    if (!existed) {
                        values[k] = i;
                        solve(values, k);
                    }
                }
            }
        }

        solve(values, -1);

        return longestPath;
    }

    /**
     * Find theme ordering to maximise the number of shared events between neighbouring themes.
     */
    function computeThemeOrdering() {
        // Build shared events graph (undirected): vertex is theme, edge is num of shared events between themes
        // - Table of shared events: only store on i<j
        var table = new Array(numThemes);
        for (var i = 0; i < numThemes; i++) {
            table[i] = new Array(numThemes);
            for (var j = 0; j < numThemes; j++) {
                table[i][j] = 0;
            }
        }

        data.forEach(function(d) {
            if (d.themeIds.length === 2) {
                table[d.themeIds[0]][d.themeIds[1]]++;
            }
        });

        // - Convert to graph
        var edges = [];
        for (var i = 0; i < numThemes; i++) {
            for (var j = i + 1; j < numThemes; j++) {
                if (table[i][j] > 0) {
                    edges.push({ vertex1: i, vertex2: j, weight: table[i][j] });
                }
            }
        }

        // Sort descendingly by number of shared events
        edges.sort(function(a, b) {
            return d3.descending(a.weight, b.weight);
        });

        // Initialise array of vertex degree in the new empty graph
        var degrees = sm.createArray(numThemes, 0);

        // Add non-zero weighted edges to the new graph
        var addedEdges = [];
        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var v1 = e.vertex1;
            var v2 = e.vertex2;
            if (degrees[v1] < 2 && degrees[v2] < 2) {
                addedEdges.push(e);
                degrees[v1]++;
                degrees[v2]++;
            }
        }

        // There are M sub-graphs and N disconnected vertices (themes without shared events)
        // For each sub-graph, its path can have 2 directions
        // Order of M sub-graphs and N disconnected vertices are not important
        // Heuristics: prioritise longer themes

        // - Find theme lengths
        var themeLengths = sm.createArray(numThemes, 0);

        themes.forEach(function(d2, i) {
            data.forEach(function(d) {
                if (d.themeIds.indexOf(i) !== -1) {
                    themeLengths[i]++;
                }
            });
        });

        // - Sort themes by length, find sorted indices
        var sortedIndices = d3.range(numThemes);
        sortedIndices.sort(function(a, b) {
            return d3.descending(themeLengths[a], themeLengths[b]);
        });

        // - Store processed stories
        var processedThemes = sm.createArray(numThemes, false);

        // - Store order of processed stories
        var orderedThemes = [];

        // - Process here
        var sortedIndex = 0;
        while (true) {
            if (sortedIndex >= sortedIndices.length) {
                break;
            }

            var processingIndex = sortedIndices[sortedIndex];

            // Stop when all stories are processed
            if (processedThemes[processingIndex]) {
                var allProcessed = processedThemes.every(function(d) { return d; });
                if (allProcessed) { // Finish
                    break;
                } else {
                    sortedIndex++;
                    continue;
                }
            }

            // Not processed, process now
            // - Disconnected vertex
            if (degrees[processingIndex] === 0) {
                processedThemes[processingIndex] = true;
                orderedThemes.push(processingIndex);
                sortedIndex++;
                continue;
            }

            // - Sub-graph: loop through all edges to find path
            // -- Find the edge containing the processing vertex
            var startVertex = 0;
            var endVertex = 0;
            for (var i = 0; i < addedEdges.length; i++) {
                var e = addedEdges[i];
                if (e.vertex1 === processingIndex || e.vertex2 === processingIndex) {
                    startVertex = e.vertex1;
                    endVertex = e.vertex2;
                    addedEdges.splice(i, 1);
                    processedThemes[processingIndex] = true;
                    break;
                }
            }

            // -- Find the path containing that edge
            var willBeRemovedEdges = [];
            var path = [startVertex, endVertex];
            while (true) {
                var founded = false;
                for (var i = 0; i < addedEdges.length; i++) {
                    var e = addedEdges[i];
                    // Got the adjacent edge
                    if (e.vertex1 === startVertex && path.indexOf(e.vertex2) === -1) {
                        path.unshift(e.vertex2); // Add the other end to the path
                        startVertex = e.vertex2;
                        willBeRemovedEdges.push(e);
                        founded = true;
                    } else if (e.vertex2 === startVertex && path.indexOf(e.vertex1) === -1) {
                        path.unshift(e.vertex1); // Add the other end to the path
                        startVertex = e.vertex1;
                        willBeRemovedEdges.push(e);
                        founded = true;
                    } else if (e.vertex1 === endVertex && path.indexOf(e.vertex2) === -1) {
                        path.push(e.vertex2); // Add the other end to the path
                        endVertex = e.vertex2;
                        willBeRemovedEdges.push(e);
                        founded = true;
                    } else if (e.vertex2 === endVertex && path.indexOf(e.vertex1) === -1) {
                        path.push(e.vertex1); // Add the other end to the path
                        endVertex = e.vertex1;
                        willBeRemovedEdges.push(e);
                        founded = true;
                    }
                }

                // - Remove edges put in the path
                for (var i = 0; i < willBeRemovedEdges.length; i++) {
                    addedEdges.splice(addedEdges.indexOf(willBeRemovedEdges[i]), 1);
                }

                // Exit if cannot find any other edge in one loop
                if (!founded) {
                    break;
                }
            }

            // -- Mark vertices in the path as processed
            path.forEach(function(i) { processedThemes[i] = true; });

            // -- Make sure the path starts with longer story
            if (themeLengths[path[0]] < themeLengths[path[path.length - 1]]) {
                path.reverse();
            }

            // -- Add the path to the answer
            orderedThemes = orderedThemes.concat(path);

            sortedIndex++;
        }

        return orderedThemes;
    }

    function computeInverseOrder() {
        var o = {};
        for (var key in orderToId) {
            o[orderToId[key]] = key;
        }
        return o;
    }

    /**
     * Computes the measurement of the legibility of the given layer based on its index (starting from the bottom).
     */
    function computeLegibilityRatio(layerIdx) {
        var events = layerEvents[layerIdx];
        if (events.length === 0) {
            return 1;
        }

        var count = d3.sum(events, function(d) { return d.full ? 5 : d.trimmed ? 3 : 0; } );
        return count / events.length / 5;
    }

    /**
     * Computes the deviation of legibility ratio of all layers.
     */
    function computeLegibilityRatioDeviation() {
        var ratios = [];
        for (var i = 0; i < numLayers; i++) {
            ratios.push(computeLegibilityRatio(i));
        }

        var mean = d3.mean(ratios);
        var dev = d3.sum(ratios, function(r) {
            return (mean - r) * (mean - r);
        });

        return dev / ratios.length;
    }

    /**
     * Re-compute layout for the given layer and adjust above layers.
     */
    function adjustLayerHeight(index, offset) {
        var layerInfo = assignedLayers[index];
        // Re-compute layout
        highestLevel = computeLayerLayout(layerInfo.startLevel, layerInfo.endLevel + offset, index) + 1;
        assignedLayers[index].ratio = computeLegibilityRatio(index);

        // Not always sucessful adjustment. Traceability algorithm can give ratio < 1 no matter layer height
        if (highestLevel === assignedLayers[index].endLevel) {
            return false;
        }

        assignedLayers[index].endLevel = highestLevel;

        // Shift above layers
        for (var i = index + 1; i < numLayers; i++) {
            if (layerEvents[i].length === 0) {
                continue;
            }

            assignedLayers[i].startLevel += offset;
            assignedLayers[i].endLevel += offset;
        }

        activeData.forEach(function(d) {
            if (d.layer > index) {
                d.level += offset;
            }
        });

        return true;
    }

    /**
     * Find the best balance between two layers.
     */
    function balanceTwoLayers(bestDev, idx1, idx2) {
        var smallIndex, largeIndex;
        if (assignedLayers[idx1].ratio < assignedLayers[idx2].ratio) {
            smallIndex = idx1;
            largeIndex = idx2;
        } else {
            smallIndex = idx2;
            largeIndex = idx1;
        }

        return balanceTwoSortedLayers(bestDev, smallIndex, largeIndex);
    }

    /**
     * Find the best balance between two layers: the small-index and the large-index
     */
    function balanceTwoSortedLayers(bestDev, smallIndex, largeIndex) {
        // Adds a level for the small-index layer, substracts a level for the large-index layer until the deviation increases and returns the best one.
        var largeLayerHeight = assignedLayers[largeIndex].endLevel - assignedLayers[largeIndex].startLevel;
        var smallLayerRatio = assignedLayers[smallIndex].ratio;
        var dev = bestDev;

        while (largeLayerHeight > 1 && smallLayerRatio < 1) {
            if (smallIndex < largeIndex) {
                adjustLayerHeight(smallIndex, 1);
                adjustLayerHeight(largeIndex, -1);
            } else {
                adjustLayerHeight(largeIndex, -1);
                adjustLayerHeight(smallIndex, 1);
            }

            var dev = computeLegibilityRatioDeviation();
            largeLayerHeight = assignedLayers[largeIndex].endLevel - assignedLayers[largeIndex].startLevel;
            smallLayerRatio = assignedLayers[smallIndex].ratio;

            // Roll back if worse
            if (dev > bestDev) {
                if (smallIndex < largeIndex) {
                    adjustLayerHeight(smallIndex, -1);
                    adjustLayerHeight(largeIndex, 1);
                } else {
                    adjustLayerHeight(largeIndex, 1);
                    adjustLayerHeight(smallIndex, -1);
                }

                break;
            } else {
                bestDev = dev;
            }
        }

        return bestDev;
    }

    /**
     * Translate the event.
     */
    function translateEvent(eventData, transitionDuration) {
        var t = eventData.originalTranslate;
        if (!t) { return; }

        var tDest = [xScale(eventData.time), yScale(eventData.level)];
        if (t[0] === -width || t[1] === 0) { // Enter events, no transition
            d3.select(eventData.ref).attr("transform", function() { return "translate(" + tDest[0] + "," + tDest[1] + ")"; });
        } else { // Update events, movement
            d3.select(eventData.ref)
                .attr("transform", function() { return "translate(" + t[0] + "," + t[1] + ")"; })
                .transition().duration(transitionDuration)
                .each("start", function() { d3.select(this).style("opacity", 1); })
                .attr("transform", function() { return "translate(" + tDest[0] + "," + tDest[1] + ")"; });
        }
    }

    /**
     * Draws set representation.
     */
    function drawSets() {
        outlineGroup.selectAll("g").remove();
        outlineGroup.selectAll("path").remove();
        outlineBorderGroup.selectAll("g").remove();
        outlineBorderGroup.selectAll("path").remove();

        events.each(function() {
            d3.select(this).select(".sm-timeSets-svg-event-background").style("opacity", 0);
        });

        // Update top-bottom attributes after layout is computed
        updateEventBoundaries();

        if (setMode === "path") {
            // Find the method to generate shapes
            if (intersectionMode === "color-blending1" || intersectionMode === "color-blending2") {
                shapeMode = "set";
            } else {
                shapeMode = compactingMode ? "layer" : "wholevis";
            }

            if (compactingMode && (intersectionMode === "gradient1" || intersectionMode === "gradient2")) {
                drawDiscretePathSets();
            } else {
                drawContinuousPathSets();
            }

            if (elementMode === "gradient" && !usePicture) {
                events.each(function(d) {
                    d3.select(this).select(".sm-timeSets-svg-event-background").style("opacity", d.trust);
                });
                drawLocalSets();
            }
        } else if (setMode === "line") {
            drawLineSets();
        } else if (setMode === "local") {
            events.each(function(d) {
                d3.select(this).select(".sm-timeSets-svg-event-background").style("opacity", d.trust);
            });
            drawLocalSets();
        } else if (setMode === "background") {
            drawCloseSets();
        }

        // Show layer boundaries for testing
        // drawExtremeRects();
    }

    /**
     * Draws sets as lines.
     */
    function drawLineSets() {
        if (applyLayout) {
            var drawnEdges = d3.set([]);
            var count = 0;

            for (var i = 0; i < numThemes; i++) {
                var themeId = orderToId[i];
                if (!activeThemeIds[themeId]) {
                    continue;
                }

                var idx = count++ * 2;

                var path = [];
                activeData.forEach(function(d) {
                    if (d.ref && (d.layer === idx || d.layer === idx - 1 || d.layer === idx + 1)) {
                        path.push( {x: xScale(d.time), y: yScale(d.level) });
                    }
                });

                var g = outlineGroup.append("g");

                // // Spanning tree
                // var emst = sm.emst().points(path);
                // emst.call();
                // var tree = emst.getEMST();
                // tree.forEach(function(d) {
                //     var p1 = path[d.v1];
                //     var p2 = path[d.v2];
                //     var e = p1.x < p2.x ? p1.x + "#" + p1.y + "#" + p2.x + "#" + p2.y : p2.x + "#" + p2.y + "#" + p1.x + "#" + p1.y;
                //     var w = drawnEdges.has(e) ? 3 : 6;
                //     if (!drawnEdges.has(e)) {
                //         drawnEdges.add(e);
                //     }

                //     g.append("line")
                //         .attr("x1", p1.x).attr("y1", p1.y)
                //         .attr("x2", p2.x).attr("y2", p2.y)
                //         .style("stroke-width", w)
                //         .style("stroke", cScale(themeId));
                // });

                // Simple line
                path = path.sort(function(a, b) { return d3.ascending(a.x, b.x);} );
                for (var j = 0; j < path.length - 1; j++) {
                    var p1 = path[j];
                    var p2 = path[j + 1];
                    var e = p1.x < p2.x ? p1.x + "#" + p1.y + "#" + p2.x + "#" + p2.y : p2.x + "#" + p2.y + "#" + p1.x + "#" + p1.y;
                    var w = drawnEdges.has(e) ? 3 : 6;
                    if (!drawnEdges.has(e)) {
                        drawnEdges.add(e);
                    }

                    g.append("line")
                        .attr("x1", p1.x).attr("y1", p1.y)
                        .attr("x2", p2.x).attr("y2", p2.y)
                        .style("stroke-width", w)
                        .style("stroke", cScale(themeId));
                }
            }
        } else {
            for (var i = 0; i < numThemes; i++) {
                if (!activeThemeIds[i]) {
                    continue;
                }

                var path = [];
                activeData.forEach(function(d) {
                    if (d.ref && d.themeIds.indexOf(i) !== -1) {
                        path.push( {x: xScale(d.time), y: yScale(d.level) });
                    }
                });

                var emst = sm.emst().points(path);
                emst.call();

                var g = outlineGroup.append("g");

                var tree = emst.getEMST();
                tree.forEach(function(d) {
                    var p1 = path[d.v1];
                    var p2 = path[d.v2];

                    g.append("line")
                        .attr("x1", p1.x).attr("y1", p1.y)
                        .attr("x2", p2.x).attr("y2", p2.y)
                        .style("stroke-width", 4)
                        .style("stroke", cScale(i));
                });
            }
        }
    }

    /**
     * Draws sets as paths.
     */
    function drawDiscretePathSets() {
        outlineGroup.selectAll("g").remove();
        outlineGroup.selectAll("path").remove();
        outlineBorderGroup.selectAll("g").remove();
        outlineBorderGroup.selectAll("path").remove();

        for (var i = 0; i < numLayers; i++) {
            if (layerEvents[i].length === 0) {
                continue;
            }

            var color = null, aboveColor = null, belowColor = null;
            if (i % 2) { // Combined theme of the above and below layer, but active
                var themeIdAbove = orderToId[getFullLayerIndex((i + 1) / 2)];
                var themeIdBelow = orderToId[getFullLayerIndex((i - 1) / 2)];

                if (!activeThemeIds[themeIdAbove] || !activeThemeIds[themeIdBelow]) {
                    continue;
                } else {
                    aboveColor = cScale(themeIdAbove);
                    belowColor = cScale(themeIdBelow);
                }
            } else { // Single theme
                var themeId = orderToId[getFullLayerIndex(i / 2)];
                if (!activeThemeIds[themeId]) {
                    continue;
                } else {
                    color = cScale(themeId);
                }
            }

            // Compute outline of the layer
            var shapeOutline = getShapeOutlineForLayer(i);
            var roundedPath = shapeOutline.generate45Path(CORNER_RADIUS);

            // The path itself
            var g = outlineGroup.append("g");
            var path = g.append("path")
                .classed("sm-timeSets-svg-path", true)
                .attr("d", roundedPath)
                .attr("index", i)
                .on("mouseover", function() {
                    // highlightPathBorder(+d3.select(this).attr("index"));
                }).on("mouseout", function() {
                    legend.dehighlightRows();
                    dehighlightEvents();
                });

            // Border
            // if (color) {
            //     path.style("stroke", d3.rgb(color).darker(DARKER_RATIO));
            // } else {
            //     path.style("stroke", d3.rgb(belowColor).darker(DARKER_RATIO));

            //     // Duplicate a path for two-color dash
            //     var dupPath = g.append("path")
            //         .attr("d", roundedPath)
            //         .style("fill", "none")
            //         .style("stroke-dasharray", "15,15")
            //         .style("stroke-width", 2)
            //         .style("stroke-opacity", 1)
            //         .style("stroke", d3.rgb(aboveColor).darker(DARKER_RATIO));
            // }

            // Visualise the intersection layers
            if (intersectionMode === "color-blending1" || intersectionMode === "color-blending2") {
                if (color) {
                    path.style("fill", color);
                } else {
                    path.style("fill", d3.interpolateRgb(aboveColor, belowColor)(0.5));
                }
            } else if (intersectionMode === "gradient1" || intersectionMode === "gradient2") {
                if (color) {
                    path.style("fill", color);
                } else {
                    // Vertical gradient from the bottom to the top (y: 1->0)
                    var grad = g.append("linearGradient")
                        .attr("id", "gradient" + i)
                        .attr("x1", 0).attr("y1", 1)
                        .attr("x2", 0).attr("y2", 0);
                    path.style("fill", "url(#gradient" + i + ")");

                    // Update color stops
                    if (intersectionMode === "gradient1") {
                        grad.append("stop")
                            .attr("offset", 0)
                            .attr("stop-color", belowColor);
                        grad.append("stop")
                            .attr("offset", 1)
                            .attr("stop-color", aboveColor);
                    } else {
                        // Replicate gradient for each level
                        var numSegments = layerEvents[i].length + 1 - layerEvents[i].length % 2;
                        var segmentLength = 1 / numSegments;
                        for (var j = 0; j <= numSegments; j++) {
                            grad.append("stop")
                                .attr("offset", j * segmentLength)
                                .attr("stop-color", j % 2 ? aboveColor: belowColor);
                        }
                    }
                }
            } else if (intersectionMode === "texture") {
                g.style("opacity", 0.7);

                // Texture
                var pattern = g.append("pattern")
                    .attr("id", "pattern" + i)
                    .attr("x", 0)
                    .attr("y", 0);
                path.style("fill", "url(#pattern" + i + ")");

                var s = 12;
                var backgroundColor = "white"; // color Make single color for texture
                var backgroundColor = color;
                var foregroundColor = d3.rgb(color).darker(DARKER_RATIO).toString();
                var grad = g.append("linearGradient").attr("id", "gradient" + i);
                grad.append("stop")
                    .attr("offset", 0)
                    .attr("stop-color", backgroundColor);
                grad.append("stop")
                    .attr("offset", 0.5)
                    .attr("stop-color", foregroundColor);
                grad.append("stop")
                    .attr("offset", 1)
                    .attr("stop-color", backgroundColor);

                if (i % 2) { // Mixed
                    pattern.attr("width", 30)
                        .attr("height", 20)
                        .attr("patternUnits", "userSpaceOnUse")
                        .append("rect")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("width", 30)
                            .attr("height", 20)
                            .style("fill", backgroundColor);

                    // - Vertical
                    foregroundColor = d3.rgb(i % 4 === 1 ? aboveColor : belowColor).darker(DARKER_RATIO);
                    var grad1 = g.append("linearGradient")
                        .attr("id", "gradient1" + i)
                        .attr("x1", 0).attr("y1", 1)
                        .attr("x2", 0).attr("y2", 0);
                    grad1.append("stop")
                        .attr("offset", 0)
                        .attr("stop-color", backgroundColor);
                    grad1.append("stop")
                        .attr("offset", 0.5)
                        .attr("stop-color", foregroundColor);
                    grad1.append("stop")
                        .attr("offset", 1)
                        .attr("stop-color", backgroundColor);

                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 30)
                        .attr("height", s)
                        .style("fill", "url(#gradient1" + i + ")");

                    // - Horizontal
                    foregroundColor = d3.rgb(i % 4 === 1 ? belowColor : aboveColor).darker(DARKER_RATIO);
                    var grad2 = g.append("linearGradient")
                        .attr("id", "gradient2" + i)
                        .attr("x1", 0).attr("y1", 0)
                        .attr("x2", 1).attr("y2", 0);
                    grad2.append("stop")
                        .attr("offset", 0)
                        .attr("stop-color", backgroundColor);
                    grad2.append("stop")
                        .attr("offset", 0.5)
                        .attr("stop-color", foregroundColor);
                    grad2.append("stop")
                        .attr("offset", 1)
                        .attr("stop-color", backgroundColor);

                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", s)
                        .attr("height", 20)
                        .style("fill", "url(#gradient2" + i + ")");
                } else if (i % 4 === 0) { // Horizontal
                    pattern.attr("width", 30)
                        .attr("height", 20)
                        .attr("patternUnits", "userSpaceOnUse");
                    grad.attr("x1", 0).attr("y1", 0)
                        .attr("x2", 1).attr("y2", 0);

                    // - Background
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 30)
                        .attr("height", 20)
                        .style("fill", backgroundColor);
                    // - Stride
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", s)
                        .attr("height", 20)
                        .style("fill", foregroundColor)
                        .style("fill", "url(#gradient" + i + ")");
                } else { // Vertical
                    pattern.attr("width", 30)
                        .attr("height", 20)
                        .attr("patternUnits", "userSpaceOnUse");
                    grad.attr("x1", 0).attr("y1", 1)
                        .attr("x2", 0).attr("y2", 0);

                    // - Background
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 30)
                        .attr("height", 20)
                        .style("fill", backgroundColor);
                    // - Stride
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 30)
                        .attr("height", s)
                        .style("fill", "url(#gradient" + i + ")");
                }
            }
        }
    }

    /**
     * Draws sets as paths continuously.
     */
    function drawContinuousPathSets() {
        outlineGroup.selectAll("g").remove();

        if (!activeData || !activeData.length) return;

        var count = 0;

        if (shapeMode === "wholevis") { // Draw a single shape for the visualization
            // Generate shape
            var shapeOutline = getShapeOutlineForLayer(-1);
            var pathData = shapeOutline.generate45Path(CORNER_RADIUS);

            // Draw the shape without filling color
            var g = outlineGroup.append("g");
            var path = g.append("path")
                .attr("d", pathData);

            // Add color/gradient to the shape
            // - Vertical gradient from the bottom to the top (y: 1->0)
            var grad = g.append("linearGradient")
                .attr("id", intersectionMode)
                .attr("x1", 0).attr("y1", 1)
                .attr("x2", 0).attr("y2", 0);
            path.style("fill", "url(#" + intersectionMode + ")");

            // For multi-set membership figure in the paper
            // path.style("fill", "#6DD0B1");
            // return;

            // - Find color stop offsets
            var totalHeight = d3.max(assignedLayers, function(d) { return d ? d.endLevel : 0; });
            var accumLayerHeights = [0];
            var value = 0;
            for (var i = 0; i < numLayers; i++) {
                value += assignedLayers[i] ? (assignedLayers[i].endLevel - assignedLayers[i].startLevel) : 0;
                accumLayerHeights.push(value);
            }

            for (var i = 0; i < numLayers; i++) {
                var layerHeight = assignedLayers[i] ? (assignedLayers[i].endLevel - assignedLayers[i].startLevel) : 0;
                if (!layerHeight) {
                    continue;
                }

                var color = null, aboveColor = null, belowColor = null;

                if (i % 2) { // Combined theme of the above and below layer, but active
                    var themeIdAbove = orderToId[getFullLayerIndex((i + 1) / 2)];
                    var themeIdBelow = orderToId[getFullLayerIndex((i - 1) / 2)];

                    if (!activeThemeIds[themeIdAbove] || !activeThemeIds[themeIdBelow]) {
                        continue;
                    } else {
                        aboveColor = cScale(themeIdAbove);
                        belowColor = cScale(themeIdBelow);
                    }
                } else { // Single theme
                    var themeId = orderToId[getFullLayerIndex(i / 2)];
                    if (!activeThemeIds[themeId]) {
                        continue;
                    } else {
                        color = cScale(themeId);
                    }
                }

                // Update color stops
                if (intersectionMode === "gradient1") {
                    grad.append("stop")
                        .attr("offset", accumLayerHeights[i] / totalHeight)
                        .attr("stop-color", color ? color : belowColor);
                    grad.append("stop")
                        .attr("offset", accumLayerHeights[i + 1] / totalHeight)
                        .attr("stop-color", color ? color : aboveColor);
                } else {
                    // Replicate gradient for each level
                    if (color) {
                        grad.append("stop")
                            .attr("offset", accumLayerHeights[i] / totalHeight)
                            .attr("stop-color", color);
                        grad.append("stop")
                            .attr("offset", accumLayerHeights[i + 1] / totalHeight)
                            .attr("stop-color", color);
                    } else {
                        var heightInPixel = layerHeight * LEVEL_HEIGHT;
                        var segmentHeightInPixel = 12;
                        var numSegments = Math.floor(heightInPixel / segmentHeightInPixel);
                        numSegments = numSegments % 2 ? numSegments : numSegments + 1; // Must be an odd number to match colors at both ends
                        var segmentLength = layerHeight / totalHeight / numSegments;
                        var offset = accumLayerHeights[i] / totalHeight;
                        for (var j = 0; j <= numSegments; j++) {
                            grad.append("stop")
                                .attr("offset", j * segmentLength + offset)
                                .attr("stop-color", j % 2 ? aboveColor: belowColor);
                        }
                    }
                }
            }

            return;
        }

        for (var i = 0; i < numThemes; i++) {
            var themeId = orderToId[i];

            if (!activeThemeIds[themeId]) {
                continue;
            }

            // Compute outline of the path
            var idx = count++ * 2;
            var counts = [];
            counts[idx - 1] = [];
            counts[idx] = [];
            counts[idx + 1] = [];

            var rects = [];
            activeData.forEach(function(d) {
                if (d.ref && (d.layer === idx || d.layer === idx - 1 || d.layer === idx + 1)) {
                    var middle = yScale(d.level);
                    rects.push({
                        left: d.left,
                        right: d.right,
                        top: Math.floor(middle - LEVEL_HEIGHT / 2),
                        bottom: Math.floor(middle + LEVEL_HEIGHT / 2),
                        level: d.level,
                        part: intersectionMode === "color-blending2" ? (d.layer === idx - 1 ? "bottom" : d.layer === idx ? "middle": "top") : ""
                    });

                    counts[d.layer].push(d.level);
                }
            });
            var shapeOutline = sm.layout.timesetsOutline().rects(rects).verticalMode(verticalMode).fillHorizontalGap(intersectionMode.substring(0, 8) === "gradient");
            shapeOutline.call();

            // The path itself
            var currentThemeColor = cScale(themeId);
            var g = outlineGroup.append("g");
            var pathData = shapeOutline.generate45Path(CORNER_RADIUS);
            var path = g.append("path")
                .classed("sm-timeSets-svg-path", true)
                .attr("d", pathData)
                .attr("id", "path" + i)
                .attr("index", i)
                // .style("stroke", d3.rgb(currentThemeColor).darker(DARKER_RATIO))
                .on("mouseover", function() {
                    // highlightPathBorder(+d3.select(this).attr("index"));
                }).on("mouseout", function() {
                    legend.dehighlightRows();
                    dehighlightEvents();
                });

            // Visualise the intersection layers
            if (intersectionMode === "color-blending1" || intersectionMode === "color-blending2") {
                path.style("opacity", 0.5);
                if (filled) {
                    path.style("fill", cScale(themeId));
                } else {
                    path.style("stroke", cScale(themeId))
                        .style("fill", "none");
                }

            } else if (intersectionMode === "gradient1" || intersectionMode === "gradient2") {
                // Vertical gradient from the bottom to the top (y: 1->0)
                var grad = g.append("linearGradient")
                    .attr("id", intersectionMode + i)
                    .attr("x1", 0).attr("y1", 1)
                    .attr("x2", 0).attr("y2", 0);
                path.style("fill", "url(#" + intersectionMode + i + ")");

                // Find color stop offsets
                var bottomLayerHeight = counts[idx - 1].length === 0 ? 0 : d3.max(counts[idx - 1]) - d3.min(counts[idx - 1]) + 1;
                var middleLayerHeight = counts[idx].length === 0 ? 0 : d3.max(counts[idx]) - d3.min(counts[idx]) + 1;
                var topLayerHeight = counts[idx + 1].length === 0 ? 0 : d3.max(counts[idx + 1]) - d3.min(counts[idx + 1]) + 1;
                var totalLayerHeight = bottomLayerHeight + middleLayerHeight + topLayerHeight;

                // Find previous and next active theme id
                var prevThemeColor = nextThemeColor = -1;
                for (var k = i + 1; k < numThemes; k++) {
                    if (activeThemeIds[orderToId[k]]) {
                        nextThemeColor = cScale(orderToId[k]);
                        break;
                    }
                }
                for (var k = i - 1; k >= 0; k--) {
                    if (activeThemeIds[orderToId[k]]) {
                        prevThemeColor = cScale(orderToId[k]);
                        break;
                    }
                }

                // Update color stops
                if (intersectionMode === "gradient1") {
                    grad.append("stop")
                        .attr("offset", 0)
                        .attr("stop-color", prevThemeColor);
                    grad.append("stop")
                        .attr("offset", bottomLayerHeight / totalLayerHeight)
                        .attr("stop-color", currentThemeColor);
                    grad.append("stop")
                        .attr("offset", (bottomLayerHeight + middleLayerHeight) / totalLayerHeight)
                        .attr("stop-color", currentThemeColor);
                    grad.append("stop")
                        .attr("offset", 1)
                        .attr("stop-color", nextThemeColor);
                } else {
                    // Replicate gradient for each level
                    if (bottomLayerHeight > 0) {
                        var numSegments = bottomLayerHeight * 2 + 1; // Must be an odd number
                        // numSegments = bottomLayerHeight % 2 ? bottomLayerHeight + 3 : bottomLayerHeight;
                        var segmentLength = bottomLayerHeight / totalLayerHeight / numSegments;
                        for (var j = 0; j <= numSegments; j++) {
                            grad.append("stop")
                                .attr("offset", j * segmentLength)
                                .attr("stop-color", j % 2 ? currentThemeColor: prevThemeColor);
                        }
                    } else if (i > 0) {
                        grad.append("stop")
                            .attr("offset", 0)
                            .attr("stop-color", currentThemeColor);
                    }

                    if (topLayerHeight > 0) {
                        var numSegments = topLayerHeight * 2 + 1; // Must be an odd number
                        // numSegments = topLayerHeight % 2 ? topLayerHeight + 3 : topLayerHeight;
                        var segmentLength = topLayerHeight / totalLayerHeight / numSegments;
                        var offset = (bottomLayerHeight + middleLayerHeight) / totalLayerHeight;
                        for (var j = 0; j <= numSegments; j++) {
                            grad.append("stop")
                                .attr("offset", j * segmentLength + offset)
                                .attr("stop-color", j % 2 ? nextThemeColor : currentThemeColor);
                        }
                    } else if (i < numThemes - 1) {
                        grad.append("stop")
                            .attr("offset", 1)
                            .attr("stop-color", currentThemeColor);
                    }

                    // Discrete replicate
                    // if (bottomLayerHeight > 0) {
                    //     var numSegments = bottomLayerHeight;
                    //     var segmentLength = bottomLayerHeight / totalLayerHeight / numSegments;
                    //     for (var j = 0; j < numSegments; j++) {
                    //         grad.append("stop")
                    //             .attr("offset", j * segmentLength)
                    //             .attr("stop-color", prevThemeColor);
                    //         grad.append("stop")
                    //             .attr("offset", (j + 1) * segmentLength)
                    //             .attr("stop-color", currentThemeColor);
                    //     }
                    // } else if (i > 0) {
                    //     grad.append("stop")
                    //         .attr("offset", 0)
                    //         .attr("stop-color", currentThemeColor);
                    // }

                    // if (topLayerHeight > 0) {
                    //     var numSegments = topLayerHeight;
                    //     var segmentLength = topLayerHeight / totalLayerHeight / numSegments;
                    //     var offset = (bottomLayerHeight + middleLayerHeight) / totalLayerHeight;
                    //     for (var j = 0; j < numSegments; j++) {
                    //         grad.append("stop")
                    //             .attr("offset", j * segmentLength + offset)
                    //             .attr("stop-color", currentThemeColor);
                    //         grad.append("stop")
                    //             .attr("offset", (j + 1) * segmentLength + offset)
                    //             .attr("stop-color", nextThemeColor);
                    //     }
                    // } else if (i < numThemes - 1) {
                    //     grad.append("stop")
                    //         .attr("offset", 1)
                    //         .attr("stop-color", currentThemeColor);
                    // }
                }
            } else if (intersectionMode === "texture") {
                // Texture
                var pattern = g.append("pattern")
                    .attr("id", "pattern" + i)
                    .attr("x", 0)
                    .attr("y", 0);
                path.style("fill", "url(#pattern" + i + ")")
                    .style("opacity", 0.5);

                var s = 12; // Size of the dark stroke
                var backgroundScale = 1.6; // Size of the background
                var backgroundColor = currentThemeColor;
                var foregroundColor = d3.rgb(currentThemeColor).brighter(1).toString();

                var tmp = foregroundColor;
                foregroundColor = backgroundColor;
                backgroundColor = tmp;

                var grad = g.append("linearGradient").attr("id", "gradient" + i);
                grad.append("stop")
                    .attr("offset", 0)
                    .attr("stop-color", backgroundColor);
                grad.append("stop")
                    .attr("offset", 0.5)
                    .attr("stop-color", foregroundColor);
                grad.append("stop")
                    .attr("offset", 1)
                    .attr("stop-color", backgroundColor);
                if (i % 2) {
                    pattern.attr("width", 50)
                        .attr("height", s * backgroundScale)
                        .attr("patternUnits", "userSpaceOnUse");
                    grad.attr("x1", 0).attr("y1", 1)
                        .attr("x2", 0).attr("y2", 0);

                    // - Background
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 50)
                        .attr("height", s * backgroundScale)
                        .style("fill", backgroundColor);
                    // - Stride
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 50)
                        .attr("height", s)
                        .style("fill", "url(#gradient" + i + ")");
                } else {
                    pattern.attr("width", s * backgroundScale)
                        .attr("height", 20)
                        .attr("patternUnits", "userSpaceOnUse");
                    grad.attr("x1", 0).attr("y1", 0)
                        .attr("x2", 1).attr("y2", 0);

                    // - Background
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", s * backgroundScale)
                        .attr("height", 20)
                        .style("fill", backgroundColor);
                    // - Stride
                    pattern.append("rect")
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", s)
                        .attr("height", 20)
                        .style("fill", foregroundColor)
                        .style("fill", "url(#gradient" + i + ")");
                }
            }

            // Extra path for border
            // outlineBorderGroup.append("path")
            //     .classed("sm-timeSets-svg-path-border", true)
            //     .style("stroke", d3.rgb(currentThemeColor).darker(DARKER_RATIO))
            //     .style("fill", "none")
            //     .attr("d", pathData)
            //     .attr("id", "path-border" + i);
        }
    }

    /**
     * Background for individual events.
     */
    function drawLocalSets() {
        // // For a figure in the paper
        // events.each(function(d) {
        //     var w = d3.select(d.ref).select(".sm-timeSets-svg-event-text").node().getComputedTextLength() + 2;
        //     var rect = d3.select(d.ref).select(".sm-timeSets-svg-event-background").attr("width", w);
        //     if (d.themeIds.length > 1) {
        //         // Try gradient for each event
        //         // Vertical gradient from the bottom to the top (y: 1->0)
        //         var grad = d3.select(d.ref).append("linearGradient")
        //             .attr("id", "gradient" + d.id)
        //             .attr("x1", 0).attr("y1", 1)
        //             .attr("x2", 0).attr("y2", 0);
        //         rect.style("fill", "url(#gradient" + d.id + ")");

        //         // Update color stops
        //         var color = "#6dd0b1";
        //         var colors = d.themeIds.map(function(i) { return cScale(i); });
        //         colors.splice(colors.indexOf(color), 1);

        //         grad.append("stop")
        //             .attr("offset", 0.05)
        //             .attr("stop-color", color);
        //         if (d.themeIds.length === 2) {
        //             grad.append("stop")
        //                 .attr("offset", 0.5)
        //                 .attr("stop-color", colors[0]);
        //         } else {
        //             grad.append("stop")
        //                 .attr("offset", 0.35)
        //                 .attr("stop-color", colors[0]);
        //             grad.append("stop")
        //                 .attr("offset", 0.65)
        //                 .attr("stop-color", colors[1]);
        //         }
        //         grad.append("stop")
        //             .attr("offset", 0.95)
        //             .attr("stop-color", color);
        //     } else {
        //         d3.select(d.ref).select(".sm-timeSets-svg-event-background").style("fill", "none");
        //     }
        // });

        // return;

        for (var i = 0; i < numLayers; i++) {
            if (layerEvents[i].length === 0) {
                continue;
            }

            var color = null, aboveColor = null, belowColor = null;
            if (i % 2 === 0) { // Single theme
                var themeId = orderToId[getFullLayerIndex(i / 2)];
                if (!activeThemeIds[themeId]) {
                    continue;
                } else {
                    color = cScale(themeId);
                }
            } else {
                var themeIdAbove = orderToId[getFullLayerIndex((i + 1) / 2)];
                var themeIdBelow = orderToId[getFullLayerIndex((i - 1) / 2)];

                if (!activeThemeIds[themeIdAbove] || !activeThemeIds[themeIdBelow]) {
                    continue;
                } else {
                    aboveColor = cScale(themeIdAbove);
                    belowColor = cScale(themeIdBelow);
                }
            }


            layerEvents[i].forEach(function(d) {
                if (d.ref) {
                    // Start and end colors are the theme's background color
                    var onePartWidth = 15;
                    var w = d3.select(d.ref).select(".sm-timeSets-svg-event-text").node().getComputedTextLength();
                    var rect = d3.select(d.ref).select(".sm-timeSets-svg-event-background").attr("width", w);
                    var toPixelRatio = onePartWidth / w;
                    var startOffset = 0;
                    var endOffset = 1;

                    // Color transition with fix color to make the color clear: start - c1 - c1 - c2 - c2 - end
                    var part = endOffset - startOffset;

                    if (color) {
                        if (d.themeIds.length === 1) {
                            rect.style("fill", "none");
                        } else {
                            // Vertical gradient from the bottom to the top (y: 1->0)
                            var grad = d3.select(d.ref).append("linearGradient")
                                .attr("id", "gradient" + d.id)
                                .attr("x1", 0).attr("y1", 0)
                                .attr("x2", 1).attr("y2", 0);
                            rect.style("fill", "url(#gradient" + d.id + ")");

                            var numStops = (d.themeIds.length - 1) * 2;
                            var stopColors = d.themeIds.map(function(t) { return cScale(t); }).filter(function(c) { return c !== color; });

                            grad.append("stop")
                                .attr("offset", startOffset * toPixelRatio)
                                .attr("stop-color", color);

                            for (var i = 0; i < numStops; i++) {
                                grad.append("stop")
                                    .attr("offset", (startOffset + (i + 1) * part) * toPixelRatio)
                                    .attr("stop-color", stopColors[Math.floor(i / 2)]);
                            }

                            grad.append("stop")
                                .attr("offset", (startOffset + (numStops + 1) * part) * toPixelRatio)
                                .attr("stop-color", color);
                        }
                    } else {
                        // if (d.themeIds.length === 2) {
                            rect.style("fill", "none");
                        // } else {
                        //     // Vertical gradient from the bottom to the top (y: 1->0)
                        //     var grad = d3.select(d.ref).append("linearGradient")
                        //         .attr("id", "gradient" + d.id)
                        //         .attr("x1", 0).attr("y1", 0)
                        //         .attr("x2", 1).attr("y2", 0);
                        //     rect.style("fill", "url(#gradient" + d.id + ")");

                        //     var numStops = (d.themeIds.length - 2) * 2;
                        //     var stopColors = d.themeIds.map(function(t) { return cScale(t); }).filter(function(c) { return c !== aboveColor && c !== belowColor; });

                        //     grad.append("stop")
                        //         .attr("offset", startOffset * toPixelRatio)
                        //         .attr("stop-color", belowColor);

                        //     for (var i = 0; i < numStops; i++) {
                        //         grad.append("stop")
                        //             .attr("offset", (startOffset + (i + 1) * part) * toPixelRatio)
                        //             .attr("stop-color", stopColors[Math.floor(i / 2)]);
                        //     }

                        //     grad.append("stop")
                        //         .attr("offset", (startOffset + (numStops + 1) * part) * toPixelRatio)
                        //         .attr("stop-color", aboveColor);
                        // }
                    }
                }
            });
        }

        // events.each(function(d) {
        //     var w = d3.select(this).select(".sm-timeSets-svg-event-text").node().getComputedTextLength() + THEME_CIRCLE_RADIUS * 5;
        //     console.log(d);
        //     d3.select(this).select(".sm-timeSets-svg-event-background")
        //         .attr("width", w)
        //         .style("fill", color);
        // });
    }

    /**
     * Connects close-in-time same memberships elements together.
     */
    function drawCloseSets() {
        var shapeOutlines = getShapeOutlinesForCloseSets();

        for (var i = 0; i < shapeOutlines.length; i++) {
            var outline = shapeOutlines[i].outline;

            // Render it
            var pathData = outline.generate45Path(CORNER_RADIUS);
            var g = outlineGroup.append("g");
            var path = g.append("path")
                .classed("sm-timeSets-svg-path", true)
                .attr("d", pathData)
                // .style("fill-opacity", 0.5)
                .style("fill", cScale(shapeOutlines[i].setId));
        }

        // Change cluster border In TimeSets, it has white color, thus impossible to see
        // container.selectAll(".sm-timeSets-svg-cluster-rect").each(function(d) {
        //     if (d.hasSet) {
        //         d3.select(this).style("stroke", "steelblue").style("fill", "#BFEFFC");
        //     }
        // });
    }

    function getShapeOutlinesForCloseSets() {
        // The visualization consists of several "bands".
        // Each band represents a subset and connects adjacent events belonging to that set.
        var allBands = [];
        var activeBands = []; // Bands that can store on incoming events. A band becomes inactive if its membership doesn't belong to the latest event's membership
        activeData.forEach(function(d) {
            // For each set membership of the event, if there exists an active band of that set, add the event to that band.
            // Otherwise, add a new band to hold it. Other bands become inactive.
            activeBands.forEach(function(d) {
                d.active = false;
            });

            d.themeIds.forEach(function(t) {
                var added = false;
                for (var i = 0; i < activeBands.length; i++) {
                    var band = activeBands[i];
                    if (band.setId === t) {
                        band.events.push(d);
                        added = true;
                        band.active = true;

                        break;
                    }
                }

                if (!added) {
                    activeBands.push({ "setId": t, "events": [d], "active": true });
                }
            });

            // Add inactive bands to 'allBands'
            allBands = allBands.concat(activeBands.filter(function(b) { return !b.active; }));
            activeBands = activeBands.filter(function(b) { return b.active; });
        });

        // Finish traversing, add all active bands to 'allBands'
        allBands = allBands.concat(activeBands);

        // Get outline of bands
        updateEventBoundaries();

        var shapeOutlines = [];
        allBands.forEach(function(b) {
            // Generate outline for bandor band
            var rects = b.events.filter(function(d) { return d.ref && !d.cluster; });
            shapeOutlines.push({ outline: sm.layout.timesetsOutline().verticalMode(verticalMode).rects(rects).call(), setId: b.setId });
        });

        return shapeOutlines;
    }


    /**
     * Update 'left' and 'right' to relative to the container.
     * Updates 'top' and 'bottom' properties based on its level.
     */
    function updateEventBoundaries() {
        layerisedData.forEach(function(d) {
            var middle = yScale(d.level);
            // console.log(d.level);
            d.top = Math.floor(middle - LEVEL_HEIGHT / 2);
            d.bottom = Math.floor(middle + LEVEL_HEIGHT / 2);
        });
    }

    function trimLastEvents(rightmostEvents) {
        d3.values(rightmostEvents).forEach(function(d) {
            if (d.cluster) return;

            // Trim events ensuring they don't exceed the right border.
            if (d.right > width - margin.left) {
                trimText(d, width - margin.left * 2 - d.left);
            }
        });
    }

    // /**
    //  * Draws polygonal boundary of layers
    //  */
    // function drawExtremeRects() {
    //     boundaryGroup.selectAll("rect").remove();

    //     for (var i = 0; i < numLayers; i++) {
    //         var rects = getShapeOutlineForLayer(i);
    //         if (!rects) { continue; }
    //         rects = rects.getExtremeRects();

    //         for (var j = 0; j < rects.length; j++) {
    //             if (rects[j]) {
    //                 boundaryGroup.append("rect")
    //                     .style("fill", "none")
    //                     .style("stroke", "black")
    //                     .attr("x", function(d) { return rects[j].left + 1; })
    //                     .attr("y", function(d) { return yScale(j) - LEVEL_HEIGHT / 2 + 1; })
    //                     .attr("width", function(d) { return rects[j].right - rects[j].left - 2; })
    //                     .attr("height", function(d) { return LEVEL_HEIGHT - 2; });
    //             }
    //         }
    //     }
    // }

    /**
     * Build settings pannel.
     */
    function buildSettings() {
        // Dialog
        var container = $("<div id='settings'></div>").appendTo($("body"));

        container
            .attr("title", "Settings")
            .dialog({
                dialogClass: "no-padding title-center",
                width: 420,
                height: 240,
                position: {
                     my: "right-5 top+5",
                     at: "right top",
                     of: ".sm-timesets-doc-container"
                },
            });

        container.parent()
            .draggable({
                containment: $(".sm-timesets-doc-container")
            });

        container.on("dialogclose", function () {
            module.showSettings(false);
        });

        // Width
        $("<div style='padding-top:3px;float:left; padding-right:20px'><label style='margin-right:4px' for='widthSpinner'>Width:</label><input id='widthSpinner' style='width:40px' name='widthSpinner' value='" + width + " '></input></div>").appendTo(container);
        $("#widthSpinner").spinner({
            step: 100,
            stop: function() {
                width = this.value;
                module.update(null, true);
            }
        });

        // Height
        $("<div style='padding-top:3px'><label style='margin-right:4px' for='heightSpinner'>Height (number of rows):</label><input id='heightSpinner' style='width:40px' name='heightSpinner' value='" + maxLevel + " '></input></div>").appendTo(container);
        $("#heightSpinner").spinner({
            step: 1,
            stop:  function() {
                maxLevel = this.value;
                module.update(null, true);
            }
        });

        // Layout
        div = $("<div id='rdoLayoutMode' style='padding-top:3px; line-height:1; float:left; padding-right:20px'></div").appendTo(container);
        $("<label for='rdoLayoutMode' style='margin-right:4px'>Layout:</label>").appendTo(div);
        $("<input type='radio' id='radio62' name='rdoLayoutMode' value='bottom'></input><label for='radio62'>completeness</label>").appendTo(div);
        $("<input type='radio' id='radio61' name='rdoLayoutMode' checked='checked' value='middle'></input><label for='radio61'>traceability</label>").appendTo(div);
        div.find("input:radio[value=" + layoutMode + "]").attr('checked', 'checked');
        div.buttonset()
            .change(function() {
                layoutMode = $("#rdoLayoutMode").find(":checked").val();
                $("#tminDiv").css("display", layoutMode === "middle" ? "block" : "none");
                module.update(null, true);
            });


        // t_min
        $("<div id='tminDiv' style='padding-top:3px'><label style='margin-right:4px' for='tminSpinner'>t_min:</label><input id='tminSpinner' style='width:40px' name='tminSpinner' value='" + trimThresholdRatio + " '></input></div>").appendTo(container);
        $("#tminSpinner").spinner({
            step: 0.1,
            min: 0,
            max: 1,
            stop:  function() {
                trimThresholdRatio = this.value;
                module.update(null, true);
            }
        });

        $("#tminDiv").css("display", layoutMode === "middle" ? "block" : "none");

        // Set mode
        var div = $("<div id='rdoSetMode' style='padding-top:3px; line-height:1; clear:both'></div").appendTo(container);
        $("<label for='rdoLayoutMode' style='margin-right:4px'>Technique:</label>").appendTo(div);
        $("<input type='radio' id='radio11' name='rdoSetMode' value='path'></input><label for='radio11'>TimeSets</label>").appendTo(div);
        $("<input type='radio' id='radio12' name='rdoSetMode' value='line'></input><label for='radio12'>Line</label>").appendTo(div);
        $("<input type='radio' id='radio13' name='rdoSetMode' value='color'></input><label for='radio13'>Circles</label>").appendTo(div);
        $("<input type='radio' id='radio14' name='rdoSetMode' value='nolayout'></input><label for='radio14'>No Layout</label>").appendTo(div);
        $("<input type='radio' id='radio15' name='rdoSetMode' value='background'></input><label for='radio15'>Background</label>").appendTo(div);
        div.find("input:radio[value=" + setMode + "]").attr('checked', 'checked');
        div.buttonset()
            .change(function() {
                var value = $("#rdoSetMode").find(":checked").val();
                if (value === "nolayout") {
                    applyLayout = false;
                    setMode = "color";
                    layoutMode = "bottom";
                } else if (value === "background") {
                    applyLayout = false;
                    setMode = "background";
                    layoutMode = "middle";
                } else {
                    applyLayout = true;
                    setMode = value;
                    layoutMode = "middle";
                }
                updateTimeCircles();
                module.update(null, true);
            });

        // Intersection mode
        div = $("<div id='rdoIntersection' style='padding-top:3px; line-height:1'></div").appendTo(container);
        $("<label for='rdoLayoutMode' style='margin-right:4px'>Set Coloring:</label>").appendTo(div);
        // $("<input type='radio' id='radio51' name='rdoIntersection' value='color-blending1'></input><label for='radio51'>blending</label>").appendTo(div);
        $("<input type='radio' id='radio55' name='rdoIntersection' value='color-blending2'></input><label for='radio55'>blend</label>").appendTo(div);
        // $("<input type='radio' id='radio52' name='rdoIntersection' value='gradient1'></input><label for='radio52'>gradient</label>").appendTo(div);
        $("<input type='radio' id='radio53' name='rdoIntersection' value='gradient2'></input><label for='radio53'>gradient</label>").appendTo(div);
        // $("<input type='radio' id='radio54' name='rdoIntersection' value='texture'></input><label for='radio54'>texture</label>").appendTo(div);
        div.find("input:radio[value=" + intersectionMode + "]").attr('checked', 'checked');
        div.buttonset()
            .change(function() {
                intersectionMode = $("#rdoIntersection").find(":checked").val();
                module.update(null, true);
            });

        // Element mode
        var div = $("<div id='rdoElementMode' style='padding-top:3px; line-height:1'></div").appendTo(container);
        $("<label for='rdoElementMode' style='margin-right:4px'>Multiple Set Memberships:</label>").appendTo(div);
        $("<input type='radio' id='radio01' name='rdoElementMode' value='none'></input><label for='radio01'>none</label>").appendTo(div);
        $("<input type='radio' id='radio02' name='rdoElementMode' value='circles'></input><label for='radio02'>circles</label>").appendTo(div);
        $("<input type='radio' id='radio03' name='rdoElementMode' value='rings'></input><label for='radio03'>rings</label>").appendTo(div);
        $("<input type='radio' id='radio04' name='rdoElementMode' value='gradient'></input><label for='radio04'>gradient</label>").appendTo(div);
        div.find("input:radio[value=" + elementMode + "]").attr('checked', 'checked');
        div.buttonset().change(function() {
            elementMode = $("#rdoElementMode").find(":checked").val();
            updateTimeCircles();
            module.update(null, true);
        });

        // Compacting
        div = $("<div id='rdoCompactingMode' style='padding-top:3px; line-height:1; float:left; padding-right:20px'></div").appendTo(container);
        $("<label for='rdoCompactingMode' style='margin-right:4px'>Compacting:</label>").appendTo(div);
        $("<input type='radio' id='radio21' name='rdoCompactingMode' value='yes'></input><label for='radio21'>yes</label>").appendTo(div);
        $("<input type='radio' id='radio22' name='rdoCompactingMode' value='no'></input><label for='radio22'>no</label>").appendTo(div);
        div.find("input:radio[name=rdoCompactingMode][value=" + (compactingMode ? "yes" : "no") + "]").attr('checked', 'checked');
        div.buttonset()
            .change(function() {
                compactingMode = $("#rdoCompactingMode").find(":checked").val() === "yes";
                module.update(null, true);
            });

        // Balancing
        div = $("<div id='rdoBalancingMode' style='padding-top:3px; line-height:1'></div").appendTo(container);
        $("<label for='rdoBalancingMode' style='margin-right:4px'>Balancing:</label>").appendTo(div);
        $("<input type='radio' id='radio23' name='rdoBalancingMode' value='yes'></input><label for='radio23'>yes</label>").appendTo(div);
        $("<input type='radio' id='radio24' name='rdoBalancingMode' value='no'></input><label for='radio24'>no</label>").appendTo(div);
        div.find("input:radio[name=rdoBalancingMode][value=" + (balancingMode ? "yes" : "no") + "]").attr('checked', 'checked');
        div.buttonset()
            .change(function() {
                balancingMode = $("#rdoBalancingMode").find(":checked").val() === "yes";
                module.update(null, true);
            });

        // // Apply layout
        // div = $("<div id='rdoLayout' style='padding-top:3px; line-height:1'></div").appendTo(container);
        // $("<input type='radio' id='radio31' name='rdoLayout' checked='checked' value='true'></input><label for='radio31'>layout</label>").appendTo(div);
        // $("<input type='radio' id='radio32' name='rdoLayout' value='false'></input><label for='radio32'>NO layout</label>").appendTo(div);
        // div.buttonset()
        //     .change(function() {
        //         applyLayout = $("#rdoLayout").find(":checked").val() === "true";
        //         module.update(null, true);
        //     });

        return container;
    }

    // function buildHelp() {
    //     // Dialog
    //     var container = $("<div></div>").appendTo($("body"));
    //     container.attr("title", "Help")
    //        .dialog({
    //            dialogClass: "no-close no-padding title-center",
    //            position: {
    //                 my: "right+5 top+5",
    //                 at: "right top",
    //                 of: window
    //             }
    //         });

    //     $("<div style='padding-left:5px'>Scroll your mose to zoom in/out<br/>Hold and drag your mouse to move time span<br/>Use Themes menu to filter or rearrange themes.</div>").appendTo(container);
    // }

    function buildResetZoom() {
        var container = $(".sm-timesets-doc-container");
        var offset = container.offset();
        var btn = $("<button>Reset to initial view</button>")
            .addClass("sm-timeSets-reset-button")
            .button({
                icons: {
                    primary: "ui-icon-refresh"
                },
                text: false
            }).click(function() {
                zoom.translate([0, 0]).scale(1);
                module.update(null, true);
            }).appendTo(container);

        btn.offset({
                top: offset.top + container.height() - btn.height(),
                left: offset.left + container.width() - btn.width() - 10
            });
    }

    function buildCapture() {
        $("<button>Capture visualization</button>")
            .addClass("sm-timeSets-capture-button")
            .css({ right: 10, bottom: 60 })
            .button({
                icons: {
                    primary: "ui-icon-image"
                },
                text: false
            }).click(function() {
                // Capture and send to server
                // The 'finding' object
                var url = document.URL;
                url += (url.indexOf("?") === -1 ? "?" : "&");
                url += "scale=" + scale + "&tx=" + translate[0] + "&ty=" +  translate[1];

                var finding = {
                    // Common fields
                    origin: "TimeSets",
                    note: "Test params from TimeSets at " + d3.time.format("%H:%M:%S")(new Date()),
                    tags: [ { "name": "TimeSets" }, { "name": "client" } ],
                    createdBy: "phong",
                    screenshot: null,
                    // contentType: "link",
                    // Deep provenance, can be stored in provenance server
                    // provenance: { scale: scale, translate: translate },
                    // originalUrl: document.url // Will be appended with &findingId
                    url: url
                };

                // Save to database
                sm.ajax("findings", "POST", finding, function(id) {
                    // Save returned id together with provenance data for restoring it.
                });
            }).appendTo($("body"));
    }

    /**
     * Sets/gets the margin of the timeSets.
     */
    module.margin = function(value) {
        if (!arguments.length) return margin;
        margin = value;
        return this;
    };

    /**
     * Sets/gets the width of the timeSets.
     */
    module.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return this;
    };

    /**
     * Sets/gets the height of the timeSets.
     */
    module.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        if (longTick) {
            xAxis.tickSize(10 - height, 0);
        }
        maxLevel = Math.floor(height / LEVEL_HEIGHT);
        return this;
    };

    /**
     * Sets/gets the long tick option.
     */
    module.longTick = function(value) {
        if (!arguments.length) return longTick;
        longTick = value;
        if (longTick) {
            xAxis.tickSize(10 - height, 0);
        }
        return this;
    };

    /**
     * Sets/gets the element mode of the timeSets.
     */
    module.elementMode = function(value) {
        if (!arguments.length) return elementMode;
        elementMode = value;
        return this;
    };

    /**
     * Sets/gets the intersection mode of the timeSets.
     */
    module.intersectionMode = function(value) {
        if (!arguments.length) return intersectionMode;
        intersectionMode = value;
        return this;
    };

    /**
     * Sets/gets the set mode of the timeSets.
     */
    module.setMode = function(value) {
        if (!arguments.length) return setMode;
        setMode = value;
        return this;
    };

    /**
     * Sets/gets the path mode of the timeSets.
     */
    module.shapeMode = function(value) {
        if (!arguments.length) return shapeMode;
        shapeMode = value;
        return this;
    };

    /**
     * Sets/gets the balancing mode of the timeSets.
     */
    module.balancingMode = function(value) {
        if (!arguments.length) return balancingMode;
        balancingMode = value;
        return this;
    };

    /**
     * Sets/gets the compacting mode of the timeSets.
     */
    module.compactingMode = function(value) {
        if (!arguments.length) return compactingMode;
        compactingMode = value;
        return this;
    };

    /**
     * Sets/gets the use picutre mode of the timeSets.
     */
    module.usePicture = function(value) {
        if (!arguments.length) return usePicture;
        usePicture = value;
        LEVEL_HEIGHT = usePicture ? 57 : 24;
        CLUSTER_HEIGHT = LEVEL_HEIGHT - 4;
        maxLevel = Math.floor(height / LEVEL_HEIGHT);
        return this;
    };

    /**
     * Sets/gets the option applying layout of the timeSets.
     */
    module.applyLayout = function(value) {
        if (!arguments.length) return applyLayout;
        applyLayout = value;
        return this;
    };

    /**
     * Sets/gets the colors used for sets.
     */
    module.colors = function(value) {
        if (!arguments.length) return colors;
        colors = value;
        return this;
    };

    /**
     * Sets/gets the legend visibility.
     */
    module.showLegend = function(value) {
        if (!arguments.length) return legend.show();
        legend.show(value);
        return this;
    };

    /**
     * Sets/gets the settings visibility.
     */
    module.showSettings = function(value) {
        if (!arguments.length) return showSettings;
        if (showSettings != value) {
            showSettings = value;
            if (showSettings) {
                if (settingsUi === undefined) {
                    settingsUi = buildSettings();
				}
                else if (!settingsUi.dialog("isOpen")) {
                    settingsUi.dialog("open");
                }
            }
            else if (settingsUi !== undefined && settingsUi.dialog("isOpen")) {
                settingsUi.dialog("close");
             }
		}
        return this;
    };

    /**
     * Sets/gets the callback for handling event click.
     */
    module.eventViewer = function(value) {
        if (!arguments.length) return eventViewer;
        eventViewer = value;
        return this;
    };

    /**
     * Sets/gets the mode to draw vertical lines for outlines: straight/rounded/ellipse/curve
     */
    module.verticalMode = function(value) {
        if (!arguments.length) return verticalMode;
        verticalMode = value;
        return this;
    };

    /**
     * Sets/gets the scale of the canvas.
     */
    module.scale = function(value) {
        if (!arguments.length) return scale;
        if (value !== undefined && !isNaN(value)) scale = value;
        return this;
    };

    /**
     * Sets/gets the translate transform of the canvas.
     */
    module.translate = function(value) {
        if (!arguments.length) return translate;
        if (value !== undefined) translate = value;
        return this;
    };

    /**
     * Sets/gets the trust filter, a set of rating levels to be included in the display.
     * @param value
     * @returns {module}
     */
    module.trustFilter = function(value) {
        if (!arguments.length) return trustFilter;
        if (value !== undefined) trustFilter = value;
        return this;
    };

    /**
     * Applys given scale, translate.
     */
    module.applyZoom = function(_scale, _translate) {
        scale = _scale;
        translate = _translate;

        zoom.scale(scale).translate(translate);
        module.update(null, true);
    };

    /**
     * Sets/gets the layout mode.
     */
    module.layoutMode = function(value) {
        if (!arguments.length) return layoutMode;
        layoutMode = value;
        return this;
    };

    /**
     * Gets the order-id mapping.
     */
    module.orderToId = function() {
        return orderToId;
    };

    /**
     * Exports coordinates, themes, text for generating the visualisation using other methods.
     */
    module.exportData = function(fileName) {
        var results = [];
        var counts = [];
        for (var i = 0; i < themes.length; i++) {
            counts[i] = { id: i, count: 0 };
        }

        // Non-aggregate
        container.selectAll(".sm-timeSets-svg-event").each(function(d) {
            if (+d3.select(this).style("opacity") === 0) {
                return;
            }

            var circle = d3.select(this).select("circle").node();
            var box = circle.getBoundingClientRect();
            var item = { x: box.left + box.width / 2, y: height + 30 - (box.top + box.height / 2) };
            if (applyLayout) {
                var themeIdsBasedOnLayers = d.layers.map(function(l) { return orderToId[l]; });
                item.themeIds = themeIdsBasedOnLayers.join(";");
            } else {
                item.themeIds = d.themeIds.join(";");
            }
            item.themeIds.split(";").forEach(function(t) {
                counts[+t].count++;
            });

            item.text = d3.select(this).select(".sm-timeSets-svg-event-text").text();
            // if (applyLayout) {
            //     var themeIdsBasedOnLayers = d.layers.map(function(l) { return orderToId[l]; });
            //     var extraThemeIds = d.themeIds.filter(function(t) { return themeIdsBasedOnLayers.indexOf(t) == -1; });
            //     item.extraIds = extraThemeIds.join(";");
            // } else {
            //     item.extraIds = "";
            // }
            results.push(item);
        });

        // Aggregate
        container.selectAll(".sm-timeSets-svg-cluster-rect").each(function(d) {
            if (+d3.select(this).style("opacity") === 0) {
                return;
            }

            var text = d3.select(this.parentNode).select("text");
            var box = text.node().getBoundingClientRect();
            var item = { x: box.left  - getGlyphPadding(d[0]), y: height + 30 - (box.top + box.height / 2) };
            if (applyLayout) {
                var themeIdsBasedOnLayers = d[0].layers.map(function(l) { return orderToId[l]; });
                item.themeIds = themeIdsBasedOnLayers.join(";");
            } else {
                item.themeIds = d[0].themeIds.join(";");
            }
            item.themeIds.split(";").forEach(function(t) {
                counts[+t].count++;
            });

            item.text = text.text();
            // if (applyLayout) {
            //     var themeIdsBasedOnLayers = d[0].layers.map(function(l) { return orderToId[l]; });
            //     var extraThemeIds = d[0].themeIds.filter(function(t) { return themeIdsBasedOnLayers.indexOf(t) == -1; });
            //     item.extraIds = extraThemeIds.join(";");
            // } else {
            //     item.extraIds = "";
            // }
            results.push(item);
        });

        counts.sort(function(a, b) {
            return d3.descending(a.count, b.count);
        });

        // Test
        // container.style("opacity", 0.3);
        // var g = d3.select("svg").selectAll("g.newNode").data(results);
        // var nodes = g.enter().append("g").classed("newNode", true)
        //     .attr("transform", function(d) { return "translate(" + d.x + "," + (height - d.y) + ")"; } );
        // nodes.each(function(d) {
        //     var themeIds = d.themeIds.split(";");
        //     if (themeIds.length === 2) {
        //         d3.select(this).append("circle")
        //             .attr("r", THEME_CIRCLE_RADIUS * 2)
        //             .style("fill", function(d) { return cScale(themeIds[1]); });
        //     }
        //     if (d.extraIds) {
        //         var extraIds = d.extraIds.split(";");
        //         if (extraIds.length > 0) {
        //             d3.select(this).append("circle")
        //                 .attr("r", THEME_CIRCLE_RADIUS * 2)
        //                 .style("fill", function(d) { return cScale(extraIds[0]); });
        //         }
        //     }
        //     d3.select(this).append("circle")
        //         .attr("r", THEME_CIRCLE_RADIUS)
        //         .style("fill", function(d) { return cScale(themeIds[0]); });
        // });
        // nodes.append("text")
        //     .attr("x", function(d) { return getGlyphPadding(d); })
        //     .attr("y", 5)
        //     .text(function(d) { return d.text; });

        // Generate CSV file
        var descendingSize = counts.map(function(d) { return d.id; } ).join("-");
        fileName += "___" + descendingSize + ".csv";
        $.post("saveFile.php", { fileName: fileName, data: d3.csv.format(results) });
    };

    // Binds custom events
    d3.rebind(module, dispatch, "on");

    return module;
};