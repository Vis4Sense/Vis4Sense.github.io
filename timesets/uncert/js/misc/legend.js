/**
 * LEGEND module displays a dialog of legend based on the input color-text.
 */
sm.misc.legend = function() {
    var dispatch = d3.dispatch("selected", "mouseover", "mouseout", "changed", "badgeclicked");
    var list, data, startIndex;
    var sortable = true;
	var legendUi;

    /**
     * Main entry of the module.
     */
    function module(selection) {
        var DELETE_WIDTH = 0;

		selection.each(function(d) {
            var container = $("section.themes")
				.append("<div class='themes-header'>Themes<img src='img/handshake.png' /></div>");

            list = $("<ul class='sm-legend-list'></ul>").appendTo(container)
                .width(container.innerWidth() - DELETE_WIDTH);
            data = d.data;

            d.data.forEach(function(pair) {
                var item = $("<li>" + pair.text + "</li>")
					.addClass("ui-selected")
                    .appendTo(list);

                //// Delete item button
                //$('<span class="glyphicon glyphicon-remove-circle"></span>').appendTo(item)
                //      .click(function () {
                //          console.log("clicked");
                //     });

				if (d.background) {
                    pair.color ? item.css("background-color", pair.color) : item.css("background-image", pair.gradient);
                } else {
					item.append("<span style='background-color:" + pair.color + ";'</span>");
                }
            });

            // Bind events to the whole list to have better performance than each li
            list.on("mouseover", "li", function() {
                module.highlightRow($(this).index());
                dispatch.mouseover($(this).index());
            }).on("mouseout", "li", function() {
                module.dehighlightRows();
                dispatch.mouseout();
            });

            // Events
            list.bind( "mousedown", function (e) {
                e.metaKey = true;
            }).selectable({
                cancel: ".handle, img",
                selected: function(event, ui) {
                    $(ui.selected).removeClass("ui-state-disabled");

					// Reveal trust badge
					var badges = ui.selected.getElementsByTagName("img");
					if (badges.length === 1) {
						badges[0].style.visibility = "visible";
					}

                    var statusList = [];
                    list.find("li").each(function(idx, dom) {
                        statusList.push($(dom).hasClass("ui-selected"));
                    });

                    dispatch.selected(statusList);
                },
                unselected: function(event, ui) {
                    var item = $(ui.unselected).addClass("ui-state-disabled");

					// Hide trust badge
					ui.unselected.getElementsByTagName("img")[0].style.visibility = "hidden";

                    var statusList = [];
                    list.find("li").each(function(idx, dom) {
                        statusList.push($(dom).hasClass("ui-selected"));
                    });

					dispatch.cancel
                    dispatch.selected(statusList);
                },
            });

            if (sortable) {
                list.sortable({
                    handle: ".handle",
                    start: function(event, ui) {
                        startIndex = ui.item.index();
                    },
                    stop: function(event, ui) {
                        var stopIndex = ui.item.index();
                        dispatch.changed( {startIndex: startIndex, stopIndex: stopIndex} );
                    }
                }).find("li").prepend("<div class='handle'><span class='ui-icon ui-icon-carat-2-n-s'></span></div>");
            }

            // User-defined input
            $('<input id="newTheme" type="text" name="new-theme" value="Search themes" />').appendTo(container);

            // Buttons
            var btnDiv = $("<div class='sm-legend-button'></div>").appendTo(container);
            //$("<button>All</button>").button()
            //    .click(function() {
            //        dispatch.selected(sm.createArray(data.length, true));
            //        list.find("li").each(function(idx, dom) {
            //            $(dom).removeClass("ui-state-disabled").addClass("ui-selected");
            //        });
            //    })
            //    .appendTo(btnDiv);
            //$("<button>None</button>").button()
            //    .click(function() {
            //        dispatch.selected(sm.createArray(data.length, false));
            //        list.find("li").each(function(idx, dom) {
            //            $(dom).addClass("ui-state-disabled").removeClass("ui-selected");
            //        });
            //    })
            //    .appendTo(btnDiv);

			legendUi = container;
        });
	}

	/**
	 * Sets/gets the visibility of the legend.
	 */
	module.show = function(value) {
		var visible = legendUi !== undefined ? !legendUi[0].hidden : false;
	    if (!arguments.length) return visible;
        if (visible != value) {
            if (value) {
                if (legendUi === undefined) {
                    //legendUi.dialog("open");
				}
                else if (legendUi[0].hidden) {
                    legendUi[0].hidden = false;
                }
            }
            else if (legendUi !== undefined && !legendUi[0].hidden) {
                legendUi[0].hidden = true;
             }
		}
       return this;
	};

	/**
	 * Sets/gets the sortability of the legend.
	 */
	module.sortable = function(value) {
	    if (!arguments.length) return sortable;
        sortable = value;
        return this;
	};

	/**
	 * Updates legend with new numbers.
	 */
	module.updateNumbers = function(values) {
	    list.find("li").each(function(idx, dom) {
	        dom.textContent = data[idx].text + " (" + values[idx] +")";
	    });
	};

	/**
	 * Highlights the given row.
	 */
	module.highlightRow = function(rowId) {
	    list.find("li:eq(" + rowId + ")").css("font-weight", "bold");
	    /*list.find("li").not(":eq(" + rowId + ")").css("color", "rgba(0,0,0,0.3)");*/
	};

	/**
     * Highlights the given rows.
     */
    module.highlightRows = function(rowIds) {
        list.find("li").each(function(idx, dom) {
            if (rowIds.indexOf(idx) !== -1) {
                $(dom).css("font-weight", "bold").css("color", "rgba(0,0,0)");
            }/* else {
                $(dom).css("font-weight", "normal").css("color", "rgba(0,0,0,0.3)");
            }*/
        });
    };

	/**
	 * De-highlights all rows.
	 */
	module.dehighlightRows = function() {
	    list.find("li").css("font-weight", "normal").css("color", "black");
	};

	/**
	 * Updates the trust badges.
	 */
	module.updateTrust = function(items) {

		var trustMetrics = sm.misc.trustMetrics();

		var li = d3.selectAll("ul.sm-legend-list li.ui-selected");
		li.selectAll("img").remove();

		li.append("img")
			.attr("src", function() {
				var theme = this.parentNode.textContent;
				var metrics = trustMetrics(items, theme);

				if (metrics.meanRatedLevel >= 2.5) {
					return "img/high-theme.png";
				}
				else if (metrics.meanRatedLevel >= 1.5) {
					return "img/medium-theme.png";
				}
				else if (metrics.meanRatedLevel > 0.0) {
					return "img/low-theme.png";
				}
				return "img/empty-theme.png";
			})
			.on("click", function () {
				dispatch.badgeclicked(this.parentNode.textContent);
			});

	};

    // Binds custom events
    d3.rebind(module, dispatch, "on");

   	return module;
};