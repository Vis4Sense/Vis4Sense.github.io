/**
 * This module provides outline for a set of rectangles used in TimeSets.
 */
sm.layout.timesetsOutline = function() {
    var rects, // Input set of rectangles { left, right, top, bottom, level, part } in integer, part is top/middle/bottom
        extremeRects, // Rectangles covering the input in each level
        outline, // The outline of all input rectangles
        verticalMode = "rounded", // Option to draw a 'vertical' line for bends: straight/rounded/ellipse/curve
        fillHorizontalGap = false;

    function module() {
        // Assign rectangles to levels
        var levelRects = [];
        rects.forEach(function(d) {
            var level = d.level;
            if (!levelRects[level]) {
                levelRects[level] = [];
            }

            levelRects[level].push(d);
        });

        // In each level, sort increasingly by left.
        levelRects.forEach(function(d) {
            if (d) {
                d.sort(function(a, b) {
                    return d3.ascending(a.left, b.left);
                });
            }
        });

        // Merge all rectangles in the same level to remove holes and gaps
        extremeRects = [];
        levelRects.forEach(function(d, i) {
            if (d) {
                var first = d[0];
                var last = d[d.length - 1];
                var left = first.left;
                var right = last.right;

                // Fill h-gap between layers
                if (fillHorizontalGap) {
                    if (i < levelRects.length - 1) {
                        var nextLevelRects = levelRects[i + 1];
                        if (nextLevelRects) {
                            var nextFirst = nextLevelRects[0];
                            var nextLast = nextLevelRects[nextLevelRects.length - 1];
                            var threshold = 40; // Narrower than this threshold means gap
                            if (last.right - nextFirst.left < threshold) { // Extend
                                right = nextFirst.left + threshold;
                            } else if (nextLast.right - first.left < threshold) { // Extend
                                left = nextLast.right - threshold;
                            }
                        }
                    }
                }

                extremeRects[i] = {
                    left: left,
                    right: right,
                    top: first.top,
                    bottom: first.bottom,
                    level: d[0].level
                };
            }
        });

        // Extend top and bottom part for better perception of set intersection
        // - Find the range of top and bottom parts
        var startBottom = -1,
            stopBottom = -1,
            startTop = -1,
            stopTop = -1;
        var topOnly = rects.filter(function(d) { return d.part === "top"; }).sort(function(a, b) { return a.level > b.level; });
        if (topOnly.length) {
            startTop = topOnly[0].level;
            stopTop = topOnly[topOnly.length - 1].level + 1;
        }

        var bottomOnly = rects.filter(function(d) { return d.part === "bottom"; }).sort(function(a, b) { return a.level > b.level; });
        if (bottomOnly.length) {
            startBottom = bottomOnly[0].level;
            stopBottom = bottomOnly[bottomOnly.length - 1].level + 1;
        }

        var padding = 20;

        // - Extend bottom as inverse pyramid
        var bottomMinX = Number.MAX_VALUE, bottomMaxX = -Number.MAX_VALUE;
        var leftMostIndex, leftMostValue, rightMostIndex, rightMostValue;
        if (startBottom !== -1) {
            leftMostIndex = -1;
            leftMostValue = Number.MAX_VALUE,
            rightMostIndex = -1;
            rightMostValue = -Number.MAX_VALUE;
            for (var i = startBottom; i < stopBottom; i++) {
                var r = extremeRects[i];

                if (!r) { continue; }

                if (r.left < leftMostValue) {
                    leftMostValue = r.left;
                    leftMostIndex = i;
                }
                if (r.right > rightMostValue) {
                    rightMostValue = r.right;
                    rightMostIndex = i;
                }
            }

            var prev;
            for (var i = startBottom; i < stopBottom; i++) {
                var r = extremeRects[i];

                if (!r) { continue; }

                if (i === stopBottom - 1 && extremeRects[stopBottom]) {
                    // Add extra padding row to see intersection easier, if need
                    var r2 = extremeRects[stopBottom];
                    r2.left = Math.min(r2.left, r.left);
                    r2.right = Math.max(r2.right, r.right);
                }

                var currentLeft = r.left;
                var currentRight = r.right;

                if (i <= leftMostIndex + 1) {
                    bottomMinX = Math.min(bottomMinX, r.left);
                    r.left = bottomMinX;
                } else {
                    r.left = Math.min(r.left - padding, prev.left);
                }
                if (i <= rightMostIndex + 1) {
                    bottomMaxX = Math.max(bottomMaxX, r.right);
                    r.right = bottomMaxX;
                } else {
                    r.right = Math.max(r.right + padding, prev.right);
                }

                prev = { "left": currentLeft, "right": currentRight };
            }
        }

        // - Extend top as pyramid
        var topMinX = Number.MAX_VALUE, topMaxX = -Number.MAX_VALUE;
        if (startTop !== -1) {
            leftMostIndex = -1;
            leftMostValue = Number.MAX_VALUE;
            rightMostIndex = -1;
            rightMostValue = -Number.MAX_VALUE;
            for (var i = stopTop - 1; i >= startTop; i--) {
                var r = extremeRects[i];

                if (!r) { continue; }

                if (r.left < leftMostValue) {
                    leftMostValue = r.left;
                    leftMostIndex = i;
                }
                if (r.right > rightMostValue) {
                    rightMostValue = r.right;
                    rightMostIndex = i;
                }
            }

            var prev;
            for (var i = stopTop - 1; i >= startTop; i--) {
                var r = extremeRects[i];

                if (!r) { continue; }

                if (i === startTop && extremeRects[startTop - 1]) {
                    // Add extra padding row to see intersection easier
                    var r2 = extremeRects[startTop - 1];
                    r2.left = Math.min(r2.left, r.left);
                    r2.right = Math.max(r2.right, r.right);
                }

                var currentLeft = r.left;
                var currentRight = r.right;

                // After the left-most row, just add padding and cover previous text
                if (i >= leftMostIndex - 1) {
                    topMinX = Math.min(topMinX, r.left);
                    r.left = topMinX;
                } else {
                    r.left = Math.min(r.left - padding, prev.left);
                }
                if (i >= rightMostIndex - 1) {
                    topMaxX = Math.max(topMaxX, r.right);
                    r.right = topMaxX;
                } else {
                    r.right = Math.max(r.right + padding, prev.right);
                }

                prev = { "left": currentLeft, "right": currentRight };
            }
        }

        // Find outline
        // - Left-side
        outline = [];
        extremeRects.forEach(function(d) {
            if (!d) {
                return true;
            }

            outline.push({ x: d.left, y: d.bottom });
            outline.push({ x: d.left, y: d.top });
        });

        // - Right-side
        extremeRects.reverse();
        extremeRects.forEach(function(d) {
            if (!d) {
                return true;
            }

            outline.push({ x: d.right, y: d.top });
            outline.push({ x: d.right, y: d.bottom });
        });

        extremeRects.reverse();

        return module;
    }

    /**
     * Sets/gets the input set of rectangles.
     */
    module.rects = function(value) {
        if (!arguments.length) return rects;
        rects = value;
        return this;
    };

    /**
     * Sets/gets the mode to draw vertical lines: straight/rounded/ellipse/curve
     */
    module.verticalMode = function(value) {
        if (!arguments.length) return verticalMode;
        verticalMode = value;
        return this;
    };

    /**
     * Sets the fill horizontal gap option.
     */
    module.fillHorizontalGap = function(value) {
        fillHorizontalGap = value;
        return this;
    };

    /**
     * Returns the extreme rectangular outline.
     */
    module.getExtremeRects = function() {
        return extremeRects;
    };

    /**
     * Checks if the given 'rect' intersects with the shape
     */
    module.isIntersectedWithRect = function(rect) {
        for (var i = 0; i < extremeRects.length; i++) {
            if (areTwoRectsIntersected(rect, extremeRects[i])) {
                return true;
            }
        }

        return false;
    };

    function areTwoRectsIntersected(r1, r2) {
        if (!r1 || !r2 || r1.level !== r2.level) { return false; }

        return r1.right > r2.left && r1.left < r2.right;
    }

    /**
     * Generates the 45 degree path for outline.
     */
    module.generate45Path = function(r) {
        if (outline.length < 2) {
            return null;
        }

        if (verticalMode === "straight" || verticalMode === "rounded") {
            smoothOutline(r * 3);
        } else {
            smoothOutline(r * 4);
        }

        // Directions for each horizontal segment: left/right
        var dirs = [];
        for (var i = -1; i < outline.length - 1; i += 2) {
            var px = outline[(i + outline.length) % outline.length].x;
            var cx = outline[i + 1].x;
            dirs.push(px > cx ? "left" : "right");
        }

        // Start point is the bottom-left corner of the polygon, which is the first element in 'outline'
        // For each 'verticalMode', it needs to be moved to the right-side a bit
        var startPoint = { x: outline[0].x, y: outline[0].y };
        if (verticalMode === "rounded") {
            startPoint.x += r;
        } else {
            if (verticalMode !== "straight") {
                var d = Math.abs(outline[1].y - outline[0].y) / 2;
                startPoint.x += dirs[0] === dirs[1] ? d : (verticalMode === "curve" ? d / 2 : r);
            }
        }

        var path = "M" + startPoint.x + "," + startPoint.y + " ";

        // The outline consists of a series of pair of vertical-horizontal segments
        var numSegments = outline.length / 2;
        for (var i = 0; i < numSegments; i++) {
            // Vertical segment
            path += generateVerticalSegment(outline[i * 2], outline[i * 2 + 1],
                outline[(i * 2 - 1 + outline.length) % outline.length],
                outline[(i * 2 + 2) % outline.length],
                dirs[i], dirs[(i + 1) % numSegments], r) + " ";

            // Horizontal segment
            path += generateHorizontalSegment(outline[(i * 2 + 2) % outline.length],
                outline[(i * 2 + 3) % outline.length],
                outline[(i * 2 + 1) % outline.length],
                outline[(i * 2 + 4) % outline.length],
                dirs[(i + 1) % numSegments], dirs[(i + 2) % numSegments], r) + " ";
        }

        return path;
    };

    /**
     * Generates a vertical segment from 'currentPoint' to 'nextPoint'.
     */
    function generateVerticalSegment(currentPoint, nextPoint, pPoint, nnPoint, currentDir, nextDir, r) {
        if (verticalMode === "straight") {
            return "V" + nextPoint.y;
        } else if (verticalMode === "rounded") {
            // - Rounded 1
            var curveString = "a" + r + "," + r + " 0 0 ";
            var x = currentDir === "left" ? -r : r;
            var y = nextPoint.y > currentPoint.y ? r : -r;
            var sweepFlag = currentDir === "left" ? "1" : "0";
            if (nextPoint.y > currentPoint.y) {
                sweepFlag = currentDir === "left" ? "0" : "1";
            }
            curveString += sweepFlag + " " + x + "," + y + " ";

            // - Vertical line
            var h = Math.abs(nextPoint.y - currentPoint.y) - r * 2;
            curveString += "v" + (nextPoint.y > currentPoint.y ? h : -h);

            // - Rounded 2
            curveString += " a" + r + "," + r + " 0 0 ";
            x = nextDir === "right" ? r : -r;
            if (currentDir === nextDir) {
                sweepFlag = sweepFlag === "0" ? "1" : "0";
            }
            curveString += sweepFlag + " " + x + "," + y + " ";

            return curveString;
        }

        if (currentDir === nextDir) { // 45, a Bezier curve with currentPoint and nextPoint are 2 control points
            var d = Math.min(Math.abs(nextPoint.y - currentPoint.y), Math.abs(currentPoint.x - pPoint.x), Math.abs(nextPoint.x - nnPoint.x)) / 2;
            var target = { "x": currentPoint.x + (nextDir === "left" ? -d : d), "y": nextPoint.y };
            return "C" + currentPoint.x + "," + currentPoint.y + " " + nextPoint.x + "," + nextPoint.y + " " + target.x + "," + target.y + " ";
        } else { // 90
            var curveString;

            if (verticalMode === "rounded") {
                // - Rounded 1
                curveString = "a" + r + "," + r + " 0 0 ";
                var x = currentDir === "left" ? -r : r;
                var y = nextPoint.y > currentPoint.y ? r : -r;
                var sweepFlag = currentDir === "left" ? "1" : "0";
                if (nextPoint.y > currentPoint.y) {
                    sweepFlag = currentDir === "left" ? "0" : "1";
                }
                curveString += sweepFlag + " " + x + "," + y + " ";

                // - Vertical line
                var h = Math.abs(nextPoint.y - currentPoint.y) - r * 2;
                curveString += "v" + (nextPoint.y > currentPoint.y ? h : -h);

                // - Rounded 2
                curveString += " a" + r + "," + r + " 0 0 ";
                x = nextDir === "right" ? r : -r;
                curveString += sweepFlag + " " + x + "," + y + " ";
            } else if (verticalMode === "ellipse") {
                var x = 0;
                var y = nextPoint.y - currentPoint.y;
                // r = Math.abs(nextPoint.y - currentPoint.y) / 35 * r;
                r = Math.log(Math.abs(nextPoint.y - currentPoint.y) / 12) * r;
                var curveString = "a" + r + "," + (y / 2) + " 0 0 ";
                var sweepFlag = currentDir === "left" ? "1" : "0";
                if (nextPoint.y > currentPoint.y) {
                    sweepFlag = currentDir === "left" ? "0" : "1";
                }
                curveString += sweepFlag + " " + x + "," + y + " ";
            } else if (verticalMode === "curve") {
                // - Curve 1
                var d = Math.min(Math.abs(nextPoint.y - currentPoint.y), Math.abs(currentPoint.x - pPoint.x), Math.abs(nextPoint.x - nnPoint.x)) / 4;
                var midPointY = currentPoint.y + (nextPoint.y - currentPoint.y) / 2;
                var target = { "x": currentPoint.x + (currentDir === "left" ? -d : d), "y": midPointY };
                var curveString = "C" + currentPoint.x + "," + currentPoint.y + " " + nextPoint.x + "," + midPointY + " " + target.x + "," + target.y + " ";

                // - Curve 2
                target = { "x": currentPoint.x + (nextDir === "left" ? -d : d), "y": nextPoint.y };
                curveString += " C" + nextPoint.x + "," + midPointY + " " + nextPoint.x + "," + nextPoint.y + " " + target.x + "," + target.y + " ";
            }

            return curveString;
        }
    }

    /**
     * Generates a horizontal segment from 'currentPoint' to 'nextPoint'.
     */
    function generateHorizontalSegment(currentPoint, nextPoint, pPoint, nnPoint, currentDir, nextDir, r) {
        if (verticalMode === "straight") {
            return "H" + currentPoint.x; // TODO: wrong in name convetion
        } else if (verticalMode === "rounded") {
            return "H" + (currentPoint.x + (currentDir === "right" ? -r : r));
        }

        var d = Math.min(Math.abs(nextPoint.y - currentPoint.y), Math.abs(currentPoint.x - pPoint.x), Math.abs(nextPoint.x - nnPoint.x)) / 2;

        if (verticalMode === "curve") {
            if (currentDir !== nextDir) {
                d /= 2;
            }
        } else {
            if (currentDir !== nextDir) {
                d = r;
            }
        }

        var sign = currentDir === "left" ? 1 : -1;
        var x = currentPoint.x + d * sign;
        return " H" + x;

        // var rx = Math.abs((currentPoint.x - pPoint.x) / 2);
        // return "A" + rx + ",20 0 0 1" + x + "," + currentPoint.y + " ";
    }

    /**
     * If adjacent rows are too close to have nice individual curve, they will be merged together.
     */
    function smoothOutline(d) {
        var newOutline = [];
        var splitIdx = Math.ceil(outline.length / 2);

        // Left side: merge too close levels
        var prevX;
        for (var i = 0; i < splitIdx; i+=2) {
            var diff = outline[i].x - prevX;
            if (prevX && Math.abs(diff) < d) {
                // Merge with lefter
                newOutline.pop();
                prevX = Math.min(prevX, outline[i].x);
                newOutline[newOutline.length - 1].x = prevX;
                newOutline.push({ x: prevX, y: outline[i + 1].y });
            } else {
                if (prevX && diff < 0 && Math.abs(diff) < d) {
                    // Change direction from right to left: push the top one to the left
                    outline[i].x = outline[i + 1].x = prevX - d;
                }

                // Normal case
                newOutline.push(outline[i]);
                newOutline.push(outline[i + 1]);
                prevX = outline[i].x;
            }
        }

        // Right side
        prevX = null;
        for (var i = splitIdx; i < outline.length; i+=2) {
            var diff = outline[i].x - prevX;
            // Merge too close levels
            if (prevX && Math.abs(diff) < d) {
                // Merge with righter
                newOutline.pop();
                prevX = Math.max(prevX, outline[i].x);
                newOutline[newOutline.length - 1].x = prevX;
                newOutline.push({ x: prevX, y: outline[i + 1].y });
            } else {
                if (prevX && diff < 0 && Math.abs(diff) < d) {
                    // Change direction from right to left: push the top one to the left
                    outline[i].x = outline[i + 1].x = prevX - d;
                }

                // Normal case
                newOutline.push(outline[i]);
                newOutline.push(outline[i + 1]);
                prevX = outline[i].x;
            }
        }

        outline = newOutline;
    }

    return module;
};
