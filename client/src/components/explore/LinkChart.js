import React, { Component } from 'react'
import { connect } from 'react-redux'
import * as d3 from 'd3'

import './LinkChart.scss'

class LinkChart extends Component {
    state = {
        canvasWidth: 600,
        canvasHeight: 500,
        canvasMargin: 5,
        data: {
            nodes: null,
            links: null
        },
        highlightedEntryId: null
    }

    getSvg = () => {
        return (d3.select('#chart-canvas svg').size() > 0) ? (
            d3.select('#chart-canvas svg')
        ) : (
                d3.select('#chart-canvas')
                    .append('svg')
                    // .attr('width', this.state.canvasWidth)
                    // .attr('height', this.state.canvasHeight)
                    .attr("preserveAspectRatio", "xMinYMin meet")
                    .attr("viewBox", `0 0 ${this.state.canvasWidth} ${this.state.canvasHeight}`)
                    .classed("svg-content", true)
            )
    }

    addNodeTooltip = (element, node, tempId=null) => {
        // Option 1: div elements with HTML (not scaling!)
        // d3.select('#chart-canvas').append("div")
        //     .attr("class", "d3-tooltip")
        //     .classed('featured', () => d3.select(element).classed('featured'))
        //     .html(node.title)
        //     .style('left', element.getAttribute('cx') - 10 + 'px')
        //     .style('top', element.getAttribute('cy') - (Number(element.getAttribute('r')) + 20) + 'px')

        // Option 2: SVG scalable elements (limited styling)
        const { canvasMargin, canvasWidth } = this.state
        const offsetX = 10
        const offsetY = 22
        const padding = 4
        const circleElement = d3.select(element)
        const nodeTip = {x: Number(circleElement.attr('cx')), y: Number(circleElement.attr('cy')) - Number(circleElement.attr('r'))}

        const tooltip = this.getSvg().append('g')
            .classed('d3-tooltip', true)

        // Add tempId to both node element and tooltip property for individual node highlight tooltips
        if (tempId) { 
            circleElement.attr('data-temp-id', tempId)
            tooltip.attr('data-temp-id', tempId)
        }

        tooltip.append('rect')
        tooltip.append('text')
            .text(node.title)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'hanging')
            .classed('featured', () => d3.select(element).classed('featured'))
        tooltip.select('rect')
            .attr('width', function() { return this.parentNode.children[1].getBBox().width + (padding * 2) })
            .attr('height', function() { return this.parentNode.children[1].getBBox().height + (padding) })
            .attr('x', function() { return Math.min(nodeTip.x - offsetX, canvasWidth - this.getBBox().width - canvasMargin) })
            .attr('y', function() { return Math.max(nodeTip.y - offsetY, canvasMargin) })
        tooltip.select('text')
            .attr('x', function() { return Math.min((nodeTip.x - offsetX + padding), canvasWidth - this.parentNode.children[0].getBBox().width - canvasMargin + padding) })
            .attr('y', Math.max((nodeTip.y + padding - offsetY), canvasMargin + padding))

            // Math.max(this.getAttribute('r'), Math.min(canvasWidth - this.getAttribute('r'), d.x))
    }

    highlightLinkChain = (entryId) => {
        // Unhighlight a link chain if one is currently highlighted (e.g. consecutive mouseEnter events without a mouseOut between)
        if (this.state.highlightedEntryId) { this.unHighlightLinkChain(this.state.highlightedEntryId) }

        const { entries } = this.props;
        const routeEntryId = this.props.entryId;
        const addNodeTooltip = this.addNodeTooltip

        // Highlight selected link chain
        d3.selectAll('.link')
            .classed('highlight', (link) => (link.entryId === entryId))
            .classed('downlight', (link) => (link.entryId !== entryId))

        // Select and style corresponding nodes
        const entryNodes = entries.filter(entry => entry._id === entryId)[0].pageLinks
        d3.selectAll('.node')
            .each(function (n) {
                if (entryNodes.includes(n.title)) {
                    // Set/un-set classes based on entryId
                    d3.select(this)
                        .classed('connected', true)
                        .classed('featured', () => (routeEntryId === entryId))
                    // Add tooltips
                    addNodeTooltip(this, n)
                } else {
                    d3.select(this)
                        .classed('downlight', true)
                }
            })
        
        this.setState({highlightedEntryId: entryId})
    }

    unHighlightLinkChain = (entryId) => {
        const { entries } = this.props;
        const routeEntryId = this.props.entryId;

        // Unlighlight selected link chain
        d3.selectAll(`[id="${entryId}"]`)
            .classed('highlight', false)

        // Remove downlights
        d3.selectAll('.downlight')
            .classed('downlight', false)

        // Reset node styles
        d3.selectAll('.node')
            .classed('connected', false)
            .classed('featured', (n) => (routeEntryId ? (entries.filter(entry => entry._id === routeEntryId)[0].pageLinks.includes(n.title)) : false))

        // Remove tooltips
        d3.selectAll('.d3-tooltip').remove();

        // Reset state to null
        this.setState({highlightedEntryId: null})

        // Re-highlight route entry, if one exists
        // if (routeEntryId) {
        //     this.highlightLinkChain(routeEntryId)
        // }
    }

    drawLinkChart = () => {
        const { canvasHeight, canvasWidth, canvasMargin } = this.state
        const { entries } = this.props
        const routeEntryId = this.props.entryId
        const addNodeTooltip = this.addNodeTooltip

        // SVG setup
        var svgCanvas = this.getSvg();

        // Re-map positions to canvas scale
        var posX = d3.scaleLinear()
            .domain([0, 1])
            .range([canvasMargin, canvasWidth - canvasMargin])
        var posY = d3.scaleLinear()
            .domain([0, 1])
            .range([canvasMargin, canvasHeight - canvasMargin])
        
        // Scale nodes based on count (frequency)
        var scaleRadius = d3.scaleLinear()
            .domain([1, Math.max(...this.props.data.nodes.map(node => node.count))])
            .range([5, 30])
        var repelStrength = d3.scaleLinear()
            .domain([0, 0.5])
            .range([0, 1])

        // Drag simulations
        const drag = simulation => {

            function dragstarted(d) {
                if (!d3.event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(d) {
                d.fx = d3.event.x;
                d.fy = d3.event.y;
            }

            function dragended(d) {
                if (!d3.event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

        // Create Event Handlers for mouse
        const handleLinkMouseEnter = (d, i) => {
            this.highlightLinkChain(d.entryId)
        }

        const handleLinkMouseOut = (d, i) => {
            this.unHighlightLinkChain(d.entryId)
            if (this.props.entryId) {
                this.highlightLinkChain(this.props.entryId)
            }
        }

        function handleNodeMouseEnter(d, i) {
            const node = d3.select(this)
            node.attr('r', Number(node.attr('r')) + canvasMargin)  // Scale up circle radius
            // Highlight node and add tooltip IF node is not currently featured
            if (!node.classed('featured')) {
                node.classed('highlight', true)  // Add highlighting class
                addNodeTooltip(this, d, Math.random())  // Create tooltip
            }
        }

        function handleNodeMouseOut(d, i) {
            // Use D3 to select element, change color back to normal
            const tooltip = d3.select(this)
                .attr('r', Number(this.getAttribute('r')) - canvasMargin)
                .classed('highlight', false)
            // Remove tooltip matching node on 'data-temp-id' attribute
            d3.select(`g[data-temp-id='${tooltip.attr('data-temp-id')}']`).remove();
        }

        // Force simulations
        const forceX = d3.forceX((d) => posX(d.position)).strength(0.8)
        const forceY = d3.forceY((d) => posY(d.position)).strength(0.8)
        const linkForce = d3.forceLink().id((d) => d.title).strength(0)//.distance(10)
        const simulation = d3.forceSimulation()
            .force('link', linkForce)
            .force("x", forceX)
            .force("y", forceY)
            .force("collide", d3.forceCollide().radius((d) => scaleRadius(d.count) * 5).iterations(1))  // TODO: scale repelling strength based on node cluster density (?)
            // .force("collide", d3.forceCollide().radius((d) => (1-repelStrength(Math.abs(0.5-d.position)))*40 + (scaleRadius(d.count) * 2)).iterations(1))
        // .force("center", d3.forceCenter(canvasWidth / 2, canvasHeight / 2))  

        // Link (line) construction
        const linkElements = svgCanvas.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(this.props.data.links)
            .enter().append('line')
            .attr('id', (d) => d.entryId)
            .attr('class', 'link')
            .classed('featured', (d) => (this.props.entryId === d.entryId))
            .on('mouseenter', handleLinkMouseEnter)
            .on('mouseout', handleLinkMouseOut)

        // Node construction
        const nodeElements = svgCanvas.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(this.props.data.nodes)
            .enter().append("circle")
            .attr('id', (d) => d.title)
            .attr('class', 'node')
            .attr("r", (d) => scaleRadius(d.count))
            .classed('featured', (d) => routeEntryId ? entries.filter(entry => entry._id === routeEntryId)[0].pageLinks.includes(d.title) : false)
            .on("mouseenter", handleNodeMouseEnter)
            .on("mouseout", handleNodeMouseOut)
            .call(drag(simulation))

        // Run simulation
        simulation.nodes(this.props.data.nodes)
            .on('tick', tick)
            .on('end', () => this.props.entryId && this.highlightLinkChain(this.props.entryId))

        simulation.force('link').links(this.props.data.links)

        // Custom settings: constrain movement within canvas bounds
        function tick() {
            nodeElements
                .attr("cx", function (d) { return d.x = Math.max(Number(this.getAttribute('r')) + canvasMargin, Math.min(canvasWidth - canvasMargin - this.getAttribute('r'), d.x)); })
                .attr("cy", function (d) { return d.y = Math.max(Number(this.getAttribute('r')) + canvasMargin, Math.min(canvasHeight - canvasMargin - this.getAttribute('r'), d.y)); });

            linkElements
                .attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y)
        }
    }

    redrawChart = () => {
        d3.selectAll('#chart-canvas g')
            .remove()
        d3.selectAll('.d3-tooltip')
            .remove()
        this.drawLinkChart()
    }

    componentDidMount() {
    }

    componentDidUpdate(prevProps, prevState, snapshop) {
        // Re-render if option data from props is updated
        if (this.props.data !== prevProps.data) { this.redrawChart() }

        // Re-set 'featured' classes if route entryId parameter changed
        if (this.props.entryId !== prevProps.entryId) {
            // No active entryId
            if (prevProps.entryId) {
                // Remove any active highlight
                if (this.state.highlightId) {this.unHighlightLinkChain(prevProps.entryId)}
                // Clear ALL featured classes
                d3.selectAll('.featured').classed('featured', false)
            }
            // Active entryId
            if (this.props.entryId) {
                // Set new featured classes if new entryId exists, then highlight
                d3.selectAll('.link').classed('featured', (d) => (this.props.entryId === d.entryId))
                this.highlightLinkChain(this.props.entryId)
            }
        }

        // Highlight link chain triggered by other components
        if (this.props.highlightId && (this.props.highlightId !== prevProps.highlightId)) {
            this.highlightLinkChain(this.props.highlightId);
        }
        // Un-highlight link chain triggered by other components
        if ((!this.props.highlightId) && (this.props.highlightId !== prevProps.highlightId)) {
            this.unHighlightLinkChain(prevProps.highlightId);
            // If a route entryId exists, default to re-highlight link chain for entryId
            if (this.props.entryId) {
                this.highlightLinkChain(this.props.entryId);
            }
        }
    }

    render() {
        return (
            <React.Fragment>
                <div id='chart-canvas'></div>
            </React.Fragment>
        )
    }
}

const mapStateToProps = (state, ownProps) => {
    return {
        entries: state.option.entries
    }
}

export default connect(mapStateToProps)(LinkChart)