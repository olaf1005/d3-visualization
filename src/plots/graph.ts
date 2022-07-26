import * as d3 from "d3";
import { BasePlot, IPlotLayout, IPlotStyle, Selection } from "types";
import { createSvg } from "utility";

/** Represents a locator element for the plot. */
interface IGraphLocator {
  /** The vertex that the locator corresponds to. */
  vertex: IGraphVertex;
  /** The x-coordinate of the locator arrow. */
  x: number;
  /** The y-coordinate of the locator arrow. */
  y: number;
  /** The angle of the locator arrow. */
  rotation: number;
  /** The scale of the locator arrow. */
  scale: number;
  /** The color of the locator arrow. */
  color: string;
}

/** Represents a vertex to plot. */
interface IGraphVertex extends d3.SimulationNodeDatum {
  /** The unique identifier of the vertex. */
  id: string;
  /** The label of the vertex. */
  label?: string;

  /** Whether the vertex is currently selected. */
  selected?: boolean;
  /** Whether the vertex is currently expanded. */
  expanded?: boolean;

  /** The styling to be applied to the vertex. */
  style?: IPlotStyle;
}

/** Represents an edge to plot. */
interface IGraphEdge extends d3.SimulationLinkDatum<IGraphVertex> {
  /** Whether the edge is directed. */
  directed: boolean;
  /** The unique identifier of the source vertex. */
  source: string | IGraphVertex;
  /** The unique identifier of the target vertex. */
  target: string | IGraphVertex;

  /** The label of the edge. */
  label?: string;

  /** The styling to be applied to the edge. */
  style?: IPlotStyle;

  offset?: {
    x?: number;
    y?: number;
  };
}

/** Represents the data contained in the plot. */
interface IGraphPlotData {
  /** The vertices. */
  vertices: IGraphVertex[];
  /** The edges. */
  edges: IGraphEdge[];
}

/** Represents the layout information for the plot. */
interface IGraphPlotLayout extends IPlotLayout<"graph"> {
  /** Transition infos for a layout. */
  transition?: {
    /** Transition period. */
    duration?: number;
  };
  directionality?: GraphDirectionality;
}

/** The events that may be emitted from a graph plot. */
interface IGraphPlotEvents {
  /** An event listener that is called when a node is called exactly once (does not fire on double click). */
  singleClickNode: (vertex: IGraphVertex) => void;
  /** An event listener that is called when a node is clicked exactly twice (does not fire on single click). */
  doubleClickNode: (vertex: IGraphVertex) => void;
  /** An event listener that is called when the empty space is clicked. */
  clickSpace: () => void;
}

/** The type of easeEffect. */
type EaseEffect =
  | "easeLinear"
  | "easeQuadInOut"
  | "easeElasticIn"
  | "easeBounceInOut";
/** The type of the graph layout. */
type GraphDirectionality = "none" | "horizontal" | "vertical" | "radial";

/** Represents the data contained in the plot. */
interface ITreePlotData extends IGraphVertex {
  /** The children of the vertex. */
  children?: this[];

  /** the vertex offset for multiple tree. */
  offset?: {
    x?: number;
    y?: number;
  };
}

type GraphEdgeSelection = Selection<d3.BaseType, IGraphEdge, SVGGElement>;
type GraphVertexSelection = Selection<
  d3.BaseType,
  IGraphVertex | d3.HierarchyPointNode<ITreePlotData>,
  SVGGElement
>;

// TODO: Consider using WebCoLa to improve the performance of the visualization.
// TODO: Make sure to add definitions to the SVG for optimal performance.
/**
 * An object that persists, renders, and handles information about a graph plot.
 */
class GraphPlot extends BasePlot<
  IGraphPlotData,
  IGraphPlotLayout,
  IGraphPlotEvents
> {
  // #region DOM
  /** The container to hold the plot. The plot can still update without the container. */
  private linkSel?: GraphEdgeSelection;
  private nodeSel?: GraphVertexSelection;
  private textSel?: GraphVertexSelection;
  private locSel?: Selection<d3.BaseType, IGraphLocator, SVGGElement>;
  private selectSel?: Selection<d3.BaseType, IGraphVertex, SVGGElement>;
  // #endregion

  // #region Extensions
  private forceExt: d3.Simulation<IGraphVertex, IGraphEdge>;
  // #endregion

  // #region Forces
  private _forceNode: d3.Force<IGraphVertex, IGraphEdge>;
  private _forceLink: d3.Force<IGraphVertex, IGraphEdge>;
  private _forceX: d3.Force<IGraphVertex, IGraphEdge>;
  private _forceY: d3.Force<IGraphVertex, IGraphEdge>;
  // #endregion

  // #region Hierarchy Tree
  private _treeData: Array<ITreePlotData> = [];
  private _roots: d3.HierarchyPointNode<ITreePlotData>[] = [];
  private _nodes: d3.HierarchyPointNode<ITreePlotData>[] = [];
  private _links: IGraphEdge[] = [];
  private _defaultRadius = 15;
  // #endregion

  // #region Ease Effect
  private _easeEffect: (normalizedTime: number) => number = d3.easeLinear;
  // #endregion

  /**
   * Constructs a new graph plot.
   * @param data Data to be plotted. Optional.
   * @param layout Layout information to be used. Optional.
   * @param container The container to hold the plot. Optional.
   */
  public constructor(
    data?: IGraphPlotData,
    layout?: IGraphPlotLayout,
    container?: HTMLElement
  ) {
    super(data, layout, container);

    // Set the data.
    this._data = data ?? { vertices: [], edges: [] };
    this._layout = layout ?? {};
    this._container = container;

    // Setup the forces.
    this._forceNode = d3.forceManyBody().strength(-500);
    this._forceLink = d3
      .forceLink<IGraphVertex, IGraphEdge>()
      .id(({ id }) => id)
      .strength(0.2);
    this._forceX = d3.forceX(0).strength(0.05);
    this._forceY = d3.forceY(0).strength(0.05);

    // Initialize the extensions.
    this.zoomExt = d3
      .zoom<SVGSVGElement, unknown>()
      .filter((event) => !event.button && event.type !== "dblclick")
      .on("zoom", (event) => {
        this.contentSel?.attr("transform", event.transform);
        this.tick();
      });
    this.forceExt = d3
      .forceSimulation<IGraphVertex, IGraphEdge>()
      .force("link", this._forceLink)
      .force("charge", this._forceNode)
      .force("forceX", this._forceX)
      .force("forceY", this._forceY)
      .on("tick", this.tick.bind(this));

    // Perform setup tasks.
    this.setupElements();
  }

  /** Initializes the elements for the graph plot. */
  private setupElements() {
    if (this.container) {
      // Create the SVG element.
      const { svg } = createSvg(
        this.container,
        this.layout,
        this.isRadialDirectionality() || this.isNoneDirectionality()
      );
      this.svgSel = svg;
      this.svgSel.on("click", (event) => {
        if (event.target === event.currentTarget) this.notify("clickSpace");
      });

      // Add a definition for the arrow markers for directed edges.
      const defsSel = this.svgSel.append("defs");
      defsSel
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 20 10")
        .attr("refX", 50)
        .attr("refY", 0)
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", "#999")
        .attr("d", "M0,-10L20,0L0,10");
      defsSel
        .append("path")
        .attr("id", "pointer")
        .attr("viewBox", "-5 -5 10 10")
        .attr("d", "M-3-7.5 4.5 0-3 7.5-4.5 7.5-4.5 4.5 0 0-4.5-4.5-4.5-7.5")
        .attr("opacity", 0.4);

      // Setup the zoom behavior.
      // Notice we disable the double click zoom behavior because we allow double click to be used to
      // expand/collapse nodes.
      this.contentSel = this.svgSel.append("g");
      if (this.zoomExt) {
        this.svgSel
          .call(this.zoomExt)
          .call(this.zoomExt.transform, d3.zoomIdentity);
      }

      // Setup all of the data-related elements.
      this.linkSel = this.contentSel.append("g").selectAll("line");
      this.nodeSel = this.contentSel
        .append("g")
        .style("cursor", "pointer")
        .selectAll("circle");
      this.selectSel = this.contentSel
        .append("g")
        .attr("fill", "currentcolor")
        .style("pointer-events", "none")
        .selectAll("circle");
      this.locSel = this.svgSel.append("g").selectAll("use");
      this.textSel = this.contentSel
        .append("g")
        .attr("fill", "currentcolor")
        .style("pointer-events", "none")
        .selectAll("text");
    }
  }

  private setupSimulation() {
    if (this.isNoneDirectionality()) {
      // Set the data within the force simulation.
      this.forceExt.nodes(this._data.vertices);
      this.forceExt
        .force<d3.ForceLink<IGraphVertex, IGraphEdge>>("link")
        ?.links(this._data.edges);
    } else {
      this.forceExt.stop();
      this.buildHierarchyTreeData();
      this.buildHierarchyTrees();
    }
  }

  private clearHierarchyTreeData() {
    this._treeData = [];
    this._roots = [];
    this._nodes = [];
    this._links = [];
  }

  /**
   * Build an hierarchy tree layout
   * @param data an hierarchy tree data
   * @param offsetY offset y for multiple tree
   * @returns width & height, max size for tree
   */
  private buildHierarchyTree(data: ITreePlotData, offsetY = 0) {
    const root = d3
      .hierarchy(data)
      .sort((a, b) => d3.ascending(a.data.label, b.data.label));
    const descendants = root.descendants().length;
    const leaves = root.leaves().length;
    const multiple =
      (this.isRadialDirectionality() ? descendants * Math.PI : 0) + leaves;
    const radius =
      Math.PI *
      this._defaultRadius ** (this.isRadialDirectionality() ? 1 : 2) *
      Math.sqrt(multiple);
    const treeWidth = (radius * 2) / Math.sqrt(this._defaultRadius);
    const treeHeight = (radius * 2) / this._defaultRadius;
    const maxSize = this.isRadialDirectionality()
      ? radius * 2
      : Math.max(treeWidth, treeHeight);

    // Compute the layout.
    if (this.isRadialDirectionality()) {
      d3
        .tree()
        .size([2 * Math.PI, radius])
        .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth)(root);
    } else {
      d3.tree().size([treeWidth, treeHeight])(root);
    }

    const swap = (node: d3.HierarchyPointNode<ITreePlotData>) => {
      if (this.isHorizontalDirectionality()) {
        if (node.x !== undefined && node.y !== undefined) {
          const t = node.x;
          node.x = node.y;
          node.y = t;
        }
      }
      return node;
    };

    root.each(
      swap as unknown as (
        node: d3.HierarchyNode<ITreePlotData>
      ) => d3.HierarchyNode<ITreePlotData>
    );

    this._roots.push(root as d3.HierarchyPointNode<ITreePlotData>);

    root.descendants().forEach((node) => {
      if (this.isRadialDirectionality()) {
        node.data.offset = {
          y: offsetY + (offsetY > 0 ? radius : 0),
        };
      } else {
        (node as d3.HierarchyPointNode<ITreePlotData>).y += offsetY;
      }
      this._nodes.push(node as d3.HierarchyPointNode<ITreePlotData>);
    });

    const edges = this.data.edges;

    (root.links() as unknown as IGraphEdge[]).forEach((link) => {
      if (this.isRadialDirectionality()) {
        link.offset = {
          y: offsetY + (offsetY > 0 ? radius : 0),
        };
      }
      link.directed = !!edges.find((edge) => {
        return (
          edge.directed &&
          ((edge.source ===
            (link.source as d3.HierarchyPointNode<ITreePlotData>).data.id &&
            edge.target ===
              (link.target as d3.HierarchyPointNode<ITreePlotData>).data.id) ||
            ((edge.source as IGraphVertex).id ===
              (link.source as d3.HierarchyPointNode<ITreePlotData>).data.id &&
              (edge.target as IGraphVertex).id ===
                (link.target as d3.HierarchyPointNode<ITreePlotData>).data.id))
        );
      });
      this._links.push(link);
    });

    return {
      treeWidth,
      treeHeight,
      maxSize,
    };
  }

  private buildHierarchyTrees() {
    // Get the metrics for the SVG element.
    const { size } = createSvg(undefined, this._layout);
    const padding = 0.25 * Math.min(size.width, size.height);

    let contentWidth = padding;
    let contentHeight = 0;
    let maxContentSize = 1;
    let prevMaxSize = 0;

    this._treeData.forEach((data, index) => {
      const { treeWidth, treeHeight, maxSize } = this.buildHierarchyTree(
        data,
        this.isRadialDirectionality()
          ? prevMaxSize / 2 + index * padding
          : contentHeight
      );
      prevMaxSize += maxSize;
      contentWidth = Math.max(
        contentWidth,
        this.isVerticalDirectionality() ? treeWidth : treeHeight
      );
      contentHeight +=
        (this.isVerticalDirectionality() ? treeHeight : treeWidth) + padding;
      maxContentSize = Math.max(contentWidth, contentHeight, maxSize);
    });

    return {
      contentWidth,
      contentHeight,
      maxContentSize,
    };
  }

  /**
   * Build an hierarchy tree data from graph data.
   */
  private buildHierarchyTreeData() {
    this.clearHierarchyTreeData();
    const vertices = this.data.vertices;
    const edges = this.data.edges;
    const withChildren = (parent: IGraphVertex) => {
      const root: ITreePlotData = {
        id: parent.id,
        label: parent.label,
        selected: parent.selected,
        expanded: parent.expanded,
        style: parent.style,
        children: [],
      };
      root.children = vertices
        .filter(
          (child) =>
            !!edges.find(
              ({ source, target }) =>
                ((source as IGraphVertex).id === parent.id &&
                  (target as IGraphVertex).id === child.id) ||
                (source === parent.id && target === child.id)
            )
        )
        .map((child) => withChildren(child));
      return root;
    };
    this._treeData = vertices
      .filter(
        (vertex) =>
          !edges.find(
            ({ target }) =>
              (target as IGraphVertex).id === vertex.id || target === vertex.id
          )
      )
      .map((vertex) => withChildren(vertex));
  }

  private isNoneDirectionality() {
    return this.layout.directionality === "none";
  }

  private isRadialDirectionality() {
    return this.layout.directionality === "radial";
  }

  private isVerticalDirectionality() {
    return this.layout.directionality === "vertical";
  }

  private isHorizontalDirectionality() {
    return this.layout.directionality === "horizontal";
  }

  private transition() {
    return {
      duration: this.isNoneDirectionality() ? 0 : 500,
      ...this.layout.transition,
    };
  }

  private updateLinkSel() {
    // Update the link source and target positions.
    if (this.linkSel) {
      if (this.isNoneDirectionality()) {
        this.linkSel
          .attr("transform", null)
          .attr("x1", ({ source }) => (source as IGraphVertex).x || 0)
          .attr("y1", ({ source }) => (source as IGraphVertex).y || 0)
          .attr("x2", ({ target }) => (target as IGraphVertex).x || 0)
          .attr("y2", ({ target }) => (target as IGraphVertex).y || 0);
      } else {
        this.linkSel
          .transition()
          .ease(this._easeEffect)
          .duration(this.transition().duration)
          .attr("transform", null)
          .attr("x1", ({ source }) => (source as IGraphVertex).x || 0)
          .attr("y1", ({ source }) => (source as IGraphVertex).y || 0)
          .attr("x2", ({ target }) => (target as IGraphVertex).x || 0)
          .attr("y2", ({ target }) => (target as IGraphVertex).y || 0);
      }
    }
  }

  private updateNodeSel() {
    // Update the node positions.
    if (this.nodeSel) {
      if (this.isNoneDirectionality()) {
        this.nodeSel
          .attr("transform", null)
          .attr("cx", ({ x }) => x || 0)
          .attr("cy", ({ y }) => y || 0);
      } else {
        this.nodeSel
          .transition()
          .ease(this._easeEffect)
          .duration(this.transition().duration)
          .attr("transform", null)
          .attr("cx", ({ x }) => x || 0)
          .attr("cy", ({ y }) => y || 0);
      }
    }
  }

  private updateTextSel() {
    // Update the text positions.
    if (this.textSel) {
      const calcOffset = (r: number) => 5 + 2 * r;
      if (this.isNoneDirectionality()) {
        this.textSel
          .attr("transform", null)
          .attr("x", (d) => d.x || 0)
          .attr(
            "y",
            (d) =>
              (d.y || 0) +
              calcOffset(
                (d as IGraphVertex).style?.fillRadius ??
                  (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
                    ?.fillRadius ??
                  this._defaultRadius
              )
          );
      } else {
        this.textSel
          .transition()
          .ease(this._easeEffect)
          .duration(this.transition().duration)
          .attr("transform", null)
          .attr("x", (d) => d.x || 0)
          .attr(
            "y",
            (d) =>
              (d.y || 0) +
              calcOffset(
                (d as IGraphVertex).style?.fillRadius ??
                  (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
                    ?.fillRadius ??
                  this._defaultRadius
              )
          );
      }
    }
  }

  /**
   * Updates the plot by setting positions according to positions calculated by the force simulation.
   */
  private tick() {
    if (!this.isNoneDirectionality()) return;
    // Update the link source and target positions.
    this.updateLinkSel();

    // Update the node positions.
    this.updateNodeSel();

    // Update the selection positions.
    if (this.selectSel) {
      this.selectSel
        .attr("cx", ({ x }) => x || 0)
        .attr("cy", ({ y }) => y || 0);
    }

    // Update the text positions.
    this.updateTextSel();

    // Update the arrow positions.
    // Calculate the arrows that are not within the viewport.
    if (this.locSel) {
      const { size } = createSvg(undefined, this.layout, true);
      if (this.contentSel) {
        const transform = d3.zoomTransform(this.contentSel.node() as Element);
        const { x, y, k } = transform;
        const calcLocator = (v: IGraphVertex): IGraphLocator | null => {
          // Check if the vertex is within the viewport.
          if (v.x === undefined || v.y === undefined) return null;
          const sx = x + k * v.x;
          const sy = y + k * v.y;
          const r = v.style?.fillRadius ?? this._defaultRadius;
          if (
            sx + r >= -size.width / 2 &&
            sx - r < size.width / 2 &&
            sy + r >= -size.height / 2 &&
            sy - r < size.height / 2
          )
            return null;

          // Get a bounded position for the locator arrow.
          let bx, by: number;
          if (Math.abs(sx) * size.height <= Math.abs(sy) * size.width) {
            // Vertical clamp.
            bx = ((size.height / 2) * sx) / Math.abs(sy);
            by = Math.sign(sy) * (size.height / 2 - this._defaultRadius);
          } else {
            // Horizontal clamp.
            bx = Math.sign(sx) * (size.width / 2 - this._defaultRadius);
            by = ((size.width / 2) * sy) / Math.abs(sx);
          }
          return {
            vertex: v,
            x: bx,
            y: by,
            rotation: (Math.atan2(by, bx) * 180) / Math.PI,
            scale:
              (v.style?.fillRadius ?? this._defaultRadius) /
              this._defaultRadius,
            color: v.style?.fillColor ?? "#a1d7a1",
          };
        };
        const locators = this._data.vertices
          .map(calcLocator)
          .filter((l): l is IGraphLocator => l !== null);
        this.locSel = this.locSel
          .data(locators, (l) => l.vertex.id)
          .join("use")
          .attr("href", "#pointer")
          .style(
            "transform",
            ({ x, y, scale, rotation }) =>
              `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale})`
          )
          .attr("fill", ({ color }) => color);
      }
    }
  }
  /**
   * Handles dragging a node in the plot.
   * @returns The drag behavior.
   */
  private drag() {
    if (!this.isNoneDirectionality()) {
      return;
    }
    const onDragStarted = (
      event: d3.D3DragEvent<SVGCircleElement, IGraphVertex, IGraphVertex>
    ) => {
      this.forceExt.alphaTarget(1).restart();
      if (!event.active) this.forceExt.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    };
    const onDragEnded = (
      event: d3.D3DragEvent<SVGCircleElement, IGraphVertex, IGraphVertex>
    ) => {
      if (!event.active) this.forceExt.alphaTarget(0.0);
      event.subject.fx = null;
      event.subject.fy = null;
    };
    const onDragged = (
      event: d3.D3DragEvent<SVGCircleElement, IGraphVertex, IGraphVertex>
    ) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    };

    return d3
      .drag<SVGCircleElement, IGraphVertex, SVGElement>()
      .on("start", onDragStarted)
      .on("end", onDragEnded)
      .on("drag", onDragged);
  }

  // #region Zooming
  /** Zooms the plot to fit all of the data within the viewbox. */
  public zoomToFit() {
    // Get the size of the SVG element.
    if (!this.contentSel || !this.isNoneDirectionality()) return;
    const {
      size: { width, height },
    } = createSvg(undefined, this.layout);

    // Get the bounds of the data.
    const xExtent = d3.extent(this._data.vertices, ({ x }) => x);
    const yExtent = d3.extent(this._data.vertices, ({ y }) => y);

    // Check for invalid bounds.
    if (xExtent[0] === undefined || xExtent[1] === undefined) return;
    if (yExtent[0] === undefined || yExtent[1] === undefined) return;

    // Perform the zooming.
    const padding = 0.25;
    const [xMin, xMax] = xExtent as [number, number];
    const [yMin, yMax] = yExtent as [number, number];
    if (this.zoomExt) {
      this.contentSel
        .transition()
        .duration(500)
        .call(
          this.zoomExt.transform as never,
          d3.zoomIdentity
            .scale(
              (1 + padding) *
                Math.max((xMax - xMin) / width, (yMax - yMin) / height)
            )
            .translate(-(xMin + xMax) / 2, -(yMin + yMax) / 2)
        );
    }
  }
  // #endregion

  // #region Force Getters/Setters
  public get forceNode(): d3.Force<IGraphVertex, IGraphEdge> {
    return this._forceNode;
  }
  public set forceNode(value: d3.Force<IGraphVertex, IGraphEdge>) {
    this._forceNode = value;
    this.forceExt.force("charge", value);
  }
  public get forceLink(): d3.Force<IGraphVertex, IGraphEdge> {
    return this._forceLink;
  }
  public set forceLink(value: d3.Force<IGraphVertex, IGraphEdge>) {
    this._forceLink = value;
    this.forceExt.force("link", value);
  }
  public get forceX(): d3.Force<IGraphVertex, IGraphEdge> {
    return this._forceX;
  }
  public set forceX(value: d3.Force<IGraphVertex, IGraphEdge>) {
    this._forceX = value;
    this.forceExt.force("x", value);
  }
  public get forceY(): d3.Force<IGraphVertex, IGraphEdge> {
    return this._forceY;
  }
  public set forceY(value: d3.Force<IGraphVertex, IGraphEdge>) {
    this._forceY = value;
    this.forceExt.force("y", value);
  }
  // #endregion

  // #region Hierarchy Tree Layout Getters/Setters
  public get easeEffect(): (normalizedTime: number) => number {
    return this._easeEffect;
  }

  public set easeEffect(value: (normalizedTime: number) => number) {
    this._easeEffect = value;
  }
  // #endregion

  // #region Plot Getters/Setters
  public get container(): HTMLElement | undefined {
    return super.container;
  }
  public set container(value: HTMLElement | undefined) {
    super.container = value;
    this.setupElements();
  }
  public get layout(): IGraphPlotLayout {
    return { ...super.layout };
  }
  public set layout(value: IGraphPlotLayout) {
    super.layout = value;

    // Update the features dependent on layout.
    if (this.svgSel) {
      const { viewBox, style } = createSvg(undefined, value, true);
      this.svgSel.attr("viewBox", viewBox).attr("style", style);
    }
    this.setupSimulation();
  }
  public get data(): IGraphPlotData {
    return { ...super.data };
  }
  public set data(value: IGraphPlotData) {
    // We want to preserve positioning and velocity of nodes that are still in the graph.
    const mapOld = new Map(this._data.vertices.map((node) => [node.id, node]));
    const mapNew = new Map(value.vertices.map((node) => [node.id, node]));

    const nodes = value.vertices.map((node) => {
      const existNode = mapOld.get(node.id);
      if (!existNode) return node;
      else {
        const { id, label, expanded, selected, style, ...rest } = node;
        return {
          ...rest,
          ...existNode,
          id,
          label,
          expanded,
          selected,
          style,
        };
      }
    });
    const links = value.edges
      .filter(
        (edge) =>
          mapNew.has(edge.source as string) && mapNew.has(edge.target as string)
      )
      .map((edge) => ({ ...edge }));

    super.data = { vertices: nodes, edges: links };
    this.setupSimulation();
  }
  // #endregion

  /**
   * Triggers simulation of the graph.
   * Should be called when vertices or edges have been added or removed.
   */
  public simulate(alpha = 1.0) {
    if (!this.isNoneDirectionality()) {
      this.forceExt.stop();
      this.forceExt.alpha(alpha).stop();
      return;
    }
    this.forceExt.alpha(alpha).restart();
  }

  /**
   * Renders a plot of the graph.
   * Should be called when data is updated.
   */
  public render() {
    // Perform the smooth transition animation.
    if (this.svgSel) {
      const { size } = createSvg(undefined, this.layout);
      this.svgSel
        .transition()
        .ease(this._easeEffect)
        .duration(this.transition().duration)
        .attr(
          "viewBox",
          (this.isNoneDirectionality() || this.isRadialDirectionality()
            ? [-size.width / 2, -size.height / 2, size.width, size.height]
            : [0, 0, size.width, size.height]
          ).join(" ")
        );
    }

    // Update the links.
    const links = this.isNoneDirectionality() ? this._data.edges : this._links;

    this.linkSel = this.linkSel
      ?.data(links as IGraphEdge[], ({ source, target }) =>
        [
          (source as d3.HierarchyPointNode<ITreePlotData>).data?.id ??
            (source as IGraphVertex).id ??
            source,
          (target as d3.HierarchyPointNode<ITreePlotData>).data?.id ??
            (target as IGraphVertex).id ??
            target,
        ].join("-")
      )
      .join("line")

      // Styling is applied based on defaults and the styling passed olong with the data.
      .attr("fill", (d) => d.style?.strokeColor ?? "#999")
      .attr("stroke", (d) => d.style?.strokeColor ?? "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => d.style?.strokeWidth ?? 1)
      .attr("marker-end", ({ directed }) => (directed ? "url(#arrow)" : null));

    const nodes = this.isNoneDirectionality()
      ? this._data.vertices
      : this._nodes;

    // Update the nodes.
    this.nodeSel = this.nodeSel
      ?.data(
        nodes as (IGraphVertex | d3.HierarchyPointNode<ITreePlotData>)[],
        (d) =>
          (d as IGraphVertex).id ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data.id
      )
      .join("circle")

      // Styling is applied based on defaults and the styling passed along with the data.
      .attr(
        "r",
        (d) =>
          (d as IGraphVertex).style?.fillRadius ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data?.style?.fillRadius ??
          this._defaultRadius
      )
      .attr(
        "fill",
        (d) =>
          (d as IGraphVertex).style?.fillColor ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data?.style?.fillColor ??
          "#a1d7a1"
      )
      .attr(
        "fill-opacity",
        (d) =>
          `${
            (d as IGraphVertex).expanded ??
            (d as d3.HierarchyPointNode<ITreePlotData>).data?.expanded
              ? 0
              : 100
          }%`
      )
      .attr(
        "stroke",
        (d) =>
          (d as IGraphVertex).style?.strokeColor ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
            ?.strokeColor ??
          "#53b853"
      )
      .attr(
        "stroke-width",
        (d) =>
          (d as IGraphVertex).style?.strokeWidth ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
            ?.strokeWidth ??
          2.5
      );

    // Update the selection.
    const selectedVertices = this._data.vertices.filter((d) => d.selected);
    this.selectSel = this.selectSel
      ?.data(
        selectedVertices,
        (d) =>
          (d as IGraphVertex).id ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data.id
      )
      .join("circle")
      .attr(
        "r",
        (d) =>
          (d.style?.fillRadius ??
            (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
              ?.fillRadius ??
            this._defaultRadius) / 3
      )
      .attr("fill", "currentcolor");

    // Update the text.
    this.textSel = this.textSel
      ?.data(
        nodes as (IGraphVertex | d3.HierarchyPointNode<ITreePlotData>)[],
        (d) =>
          (d as IGraphVertex).id ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data.id
      )
      .join("text")
      .text(
        (d) =>
          (d as IGraphVertex).label ??
          (d as d3.HierarchyPointNode<ITreePlotData>).data?.label ??
          ""
      )
      .attr("text-anchor", "middle");

    if (this.isNoneDirectionality()) {
      this.nodeSel
        ?.call(this.drag() as never)
        .on("click", (e: PointerEvent, d) => {
          switch (e.detail) {
            case 1:
              this.notify("singleClickNode", d as IGraphVertex);
              break;
            case 2:
              this.notify("doubleClickNode", d as IGraphVertex);
              break;
          }
        });
      this.tick();
    } else if (this.isRadialDirectionality()) {
      // Update for radial tree layout.
      const projectPoint = (x: number, y: number) => {
        return [(y = +y) * Math.cos((x -= Math.PI / 2)), y * Math.sin(x)];
      };

      this.linkSel
        ?.transition()
        .ease(this._easeEffect)
        .duration(this.transition().duration)
        .attr("fill", "none")
        .attr("transform", (d) => `translate(0, ${d.offset?.y || 0})`)
        .attr(
          "x1",
          (d) =>
            projectPoint(
              (d.source as IGraphVertex).x as number,
              (d.source as IGraphVertex).y as number
            )[0]
        )
        .attr(
          "y1",
          (d) =>
            projectPoint(
              (d.source as IGraphVertex).x as number,
              (d.source as IGraphVertex).y as number
            )[1]
        )
        .attr(
          "x2",
          (d) =>
            projectPoint(
              (d.target as IGraphVertex).x as number,
              (d.target as IGraphVertex).y as number
            )[0]
        )
        .attr(
          "y2",
          (d) =>
            projectPoint(
              (d.target as IGraphVertex).x as number,
              (d.target as IGraphVertex).y as number
            )[1]
        );

      this.nodeSel
        ?.transition()
        .ease(this._easeEffect)
        .duration(this.transition().duration)
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("transform", (d) =>
          [
            `translate(0, ${
              (d as d3.HierarchyPointNode<ITreePlotData>).data?.offset?.y || 0
            })`,
            `rotate(${((d.x ?? 0) * 180) / Math.PI - 90})`,
            `translate(${d.y}, 0)`,
          ].join(" ")
        );

      const calcOffset = (r: number) => 5 + 2 * r;

      this.textSel
        ?.transition()
        .ease(this._easeEffect)
        .duration(this.transition().duration)
        .attr("x", 0)
        .attr("y", 0)
        .attr("transform", (d) =>
          [
            `translate(0, ${
              (d as d3.HierarchyPointNode<ITreePlotData>).data?.offset?.y || 0
            })`,
            `rotate(${((d.x ?? 0) * 180) / Math.PI - 90})`,
            `translate(${d.y ?? 0}, 0)`,
            `rotate(${(-(d.x ?? 0) * 180) / Math.PI + 90})`,
            `translate(0, ${calcOffset(
              (d as d3.HierarchyPointNode<ITreePlotData>).data?.style
                ?.fillRadius ?? this._defaultRadius
            )})`,
          ].join(" ")
        );
    } else {
      this.updateLinkSel();
      this.updateNodeSel();
      this.updateTextSel();
    }
  }
}

export default GraphPlot;
export type {
  IGraphVertex,
  IGraphEdge,
  IGraphPlotData,
  IGraphPlotLayout,
  IGraphPlotEvents,
  EaseEffect,
  GraphDirectionality,
};
