import * as d3 from "d3";
import { BasePlot, IPlotLayout, IPlotStyle, Selection } from "types";
import { createSvg, findColormap } from "utility";

/** The type of datum for each heatmap plot cell. */
interface IHeatmapCell {
  /** A unique identifier for the cell. */
  id: string;

  /** An optional label for the cell. */
  label?: string;

  /** The value of the cell. */
  value: number;

  /** Whether the cell is selected. */
  selected?: boolean;

  /** The optional styles to apply to the cell. */
  style?: IPlotStyle;
}

/** Represents the data contained in the plot. */
interface IHeatmapPlotData<TDatum extends IHeatmapCell = IHeatmapCell> {
  /** The data to plot. */
  data: TDatum[][];
  /** The colormap to use for mapping values to colors. */
  colormap?: string;
}

/** Represents the layout information for the plot. */
interface IHeatmapPlotLayout extends IPlotLayout<"heatmap"> {
  /** Define the color bar. */
  colorBar?: {
    /** Whether to show the color bar. */
    show?: boolean;
    /** Define the width percent of the color bar based on plot width. */
    width?: number;
    /** Define the gap percent between the color bar and the heatmap plot based on plot width. */
    gap?: number;
    /** Define the tickmark count for the color bar */
    tickmarkCount?: number;
    /** Define the min value for the color bar */
    min?: number;
    /** Define the max value for the color bar */
    max?: number;
  };
  /** Define the axis infos for the heatmap plot. */
  groups?: {
    /** Define the axis x of the heatmap plot. */
    x?: {
      /** The texts for each columns. */
      labels?: string[];
      /** The number of columns. */
      length?: number;
    };
    /** Define the axis y of the heatmap plot. */
    y?: {
      /** The texts for each rows. */
      labels?: string[];
      /** The number of rows. */
      length?: number;
    };
  };
}

/** The events that may be emitted from a heatmap plot. */
interface IHeatmapPlotEvents {
  /** An event listener that is called when a bin is called exactly once (does not fire on double click). */
  singleClickCell: (bin: IHeatmapCell) => void;
  /** An event listener that is called when a bin is clicked exactly twice (does not fire on single click). */
  doubleClickCell: (bin: IHeatmapCell) => void;
  /** An event listener that is called when the empty space is clicked. */
  clickSpace: () => void;
}

type AxisSelection = Selection<SVGGElement, unknown, HTMLElement>;
type AxisScale = d3.ScaleBand<string>;

/**
 * An object that persists, renders, and handles information about a heatmap plot in 2D.
 */
class HeatmapPlot extends BasePlot<
  IHeatmapPlotData,
  IHeatmapPlotLayout,
  IHeatmapPlotEvents
> {
  // #region DOM
  private cellsSel?: Selection<SVGGElement, IHeatmapCell[], SVGGElement>;
  private textsSel?: Selection<SVGGElement, IHeatmapCell[], SVGGElement>;
  private colorBoard?: Selection<SVGGElement, unknown, HTMLElement>;
  private colorDefs?: Selection<SVGGElement, unknown, HTMLElement>;
  private colorStopsSel?: Selection<
    SVGStopElement,
    number,
    SVGLinearGradientElement
  >;
  private tickmarkLinesSel?: Selection<SVGGElement, number, SVGGElement>;
  private colorStopValuesSel?: Selection<SVGGElement, number, SVGGElement>;
  protected xAxisSelection?: AxisSelection;
  protected yAxisSelection?: AxisSelection;
  // #endregion

  // #region Data
  protected scaleX: AxisScale;
  protected scaleY: AxisScale;
  // #endregion

  // #region Data
  private _defaultLayout: IHeatmapPlotLayout = {
    colorBar: {
      show: true,
      width: 8,
      gap: 4,
      tickmarkCount: 5,
    },
  };
  // #endregion

  /**
   * Constructs a new heatmap plot.
   * @param data Data to be plotted. Optional.
   * @param layout Layout information to be used. Optional.
   * @param container THe container to hold the plot. Optional.
   */
  public constructor(
    data?: IHeatmapPlotData,
    layout?: IHeatmapPlotLayout,
    container?: HTMLElement
  ) {
    super(data, layout, container);

    // Set the data.
    this._data = data ?? { data: [] };
    this._layout = {
      ...this._defaultLayout,
      ...layout,
      colorBar: { ...this._defaultLayout.colorBar, ...layout?.colorBar },
    };
    this._container = container;

    this.scaleX = d3.scaleBand();
    this.scaleY = d3.scaleBand();

    // Perform setup tasks.
    this.setupElements();
    this.setupScales();
  }

  /** Get the total width percent of the color bar with gap. */
  private colorBarTotalPercent() {
    return this.layout.colorBar?.show
      ? (this.layout.colorBar.gap ?? 0) + (this.layout.colorBar.width ?? 0)
      : 0;
  }

  /** Initializes the scales used to transform data for the heatmap plot. */
  private setupScales() {
    // Get the metrics for the SVG element.
    const { size, margin } = createSvg(undefined, this.layout);

    const scaleRangeX = [
      margin.left,
      size.width -
        margin.right -
        (size.width * this.colorBarTotalPercent()) / 100,
    ];
    const scaleRangeY = [size.height - margin.bottom, margin.top];

    const scaleX = d3
      .scaleBand()
      .domain(d3.range(this.data.data.length).map((d) => d.toString()))
      .range(scaleRangeX)
      .padding(0.05);

    const extentYMax = Math.max(...this.data.data.map((d) => d.length));

    const scaleY = d3
      .scaleBand()
      .domain(d3.range(extentYMax).map((d) => d.toString()))
      .range(scaleRangeY)
      .padding(0.05);

    this.scaleColor = findColormap(this.data.colormap ?? "cividis");

    this.scaleX = scaleX;
    this.scaleY = scaleY;

    this.resetAxis();
  }

  /** Reset the axes. */
  protected resetAxis() {
    if (this.svgSel) {
      if (this.xAxisSelection) this.xAxis(this.xAxisSelection, this.scaleX);
      if (this.yAxisSelection) this.yAxis(this.yAxisSelection, this.scaleY);
    }
  }

  /** Initializes the elements for the heatmap plot. */
  private setupElements() {
    if (this.container) {
      // Create the SVG element.
      const { svg, size, margin } = createSvg(this.container, this.layout);

      this.svgSel = svg.on("click", (e: PointerEvent) => {
        e.stopPropagation();
        this.notify("clickSpace");
      });

      this.setupAxisElements();

      if (this.layout.colorBar?.show) {
        const tickmarkGap = 10;
        this.colorBoard = this.svgSel
          .append("g")
          .attr(
            "transform",
            `translate(${
              size.width -
              margin.right -
              ((size.width * (this.layout.colorBar?.width ?? 10)) / 100 ?? 0) -
              tickmarkGap
            }, ${margin.top})`
          );

        this.colorDefs = this.colorBoard.append("defs");
        this.colorStopsSel = this.colorDefs
          .append("linearGradient")
          .attr("id", "legend-gradient")
          .attr("gradientTransform", "rotate(90)")
          .selectAll("stop");

        this.tickmarkLinesSel = this.colorBoard
          .append("g")
          .attr(
            "transform",
            `translate(${
              (size.width * (this.layout.colorBar?.width ?? 10)) / 100 ?? 0
            }, 0)`
          )
          .selectAll("line");

        this.colorStopValuesSel = this.colorBoard
          .append("g")
          .attr("transform", `translate(${tickmarkGap}, 2)`)
          .selectAll("text");

        this.colorBoard
          .append("rect")
          .attr("fill", "url(#legend-gradient)")
          .attr(
            "width",
            (size.width * (this.layout.colorBar?.width ?? 10)) / 100 ?? 0
          )
          .attr("height", size.height - margin.top - margin.bottom);
      }

      this.contentSel = this.svgSel.append("g");

      // Create the heatmap plot elements.
      this.cellsSel = this.contentSel
        .append("g")
        .style("cursor", "pointer")
        .selectAll("g");
      this.textsSel = this.contentSel
        .append("g")
        .style("cursor", "pointer")
        .selectAll("g");
    }
  }

  /** Setup elements for axis */
  protected setupAxisElements() {
    if (this.svgSel) {
      const { size, margin } = createSvg(undefined, this._layout);

      const axisX = this._layout.axes?.x ?? {};
      const axisY = this._layout.axes?.y ?? {};
      const axisLabelColor = this._layout.style?.color ?? "";

      // Create the axes.
      if (this._layout.groups?.x?.labels)
        this.xAxisSelection = this.svgSel.append("g").lower();
      if (this._layout.groups?.y?.labels)
        this.yAxisSelection = this.svgSel.append("g").lower();

      // Add x axis label
      this.svgSel
        .append("text")
        .attr(
          "x",
          margin.left +
            (size.width -
              margin.left -
              margin.right -
              (size.width * this.colorBarTotalPercent()) / 100) /
              2
        )
        .attr("y", size.height - 5)
        .attr("text-anchor", "middle")
        .attr("fill", axisLabelColor)
        .text(axisX.label ?? "");

      // Add y axis label
      this.svgSel
        .append("text")
        .attr(
          "x",
          -(margin.top + (size.height - margin.top - margin.bottom) / 2)
        )
        .attr("y", margin.right)
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("fill", axisLabelColor)
        .text(axisY.label ?? "");
    }
  }

  /** Creates an x-axis for the plot. */
  protected xAxis(g: AxisSelection | undefined, scale: AxisScale) {
    const { size, margin } = createSvg(undefined, this._layout);
    g?.attr("transform", `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(scale))
      .selectAll<SVGGElement, string>("text")
      .text(
        (d) =>
          (this.layout.groups?.x?.labels &&
            this.layout.groups?.x?.labels[parseInt(d)]) ??
          d
      );
  }

  /** Creates an y-axis for the plot. */
  protected yAxis(g: AxisSelection | undefined, scale: AxisScale) {
    const { margin } = createSvg(undefined, this._layout);
    g?.attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(scale))
      .selectAll<SVGGElement, string>("text")
      .text(
        (d) =>
          (this.layout.groups?.y?.labels &&
            this.layout.groups?.y?.labels[parseInt(d)]) ??
          d
      );
  }

  // #region Plot Getters/Setters
  public get container(): HTMLElement | undefined {
    return super.container;
  }
  public set container(value: HTMLElement | undefined) {
    super.container = value;
    this.setupElements();
  }
  public get layout(): IHeatmapPlotLayout {
    return { ...super.layout };
  }
  public set layout(value: IHeatmapPlotLayout) {
    super.layout = {
      ...this._defaultLayout,
      ...value,
    };
    this.setupScales();

    // Update the features dependent on layout.
    if (this.svgSel) {
      const { viewBox, style } = createSvg(undefined, value);
      this.svgSel.attr("viewBox", viewBox).attr("style", style);
    }
  }
  public get data(): IHeatmapPlotData {
    return { ...super.data };
  }
  public set data(value: IHeatmapPlotData) {
    super.data = value;
    this.setupScales();
  }
  // #endregion

  /** Renders a plot of the graph. */
  public render() {
    // Get the min value from the cells.
    const minValue =
      this._layout.colorBar?.min ??
      Math.min(
        ...this.data.data.map((col) => Math.min(...col.map((c) => c.value)))
      );
    // Get the max value from the cells.
    const maxValue =
      this._layout.colorBar?.max ??
      Math.max(
        1,
        ...this.data.data.map((col) => Math.max(...col.map((c) => c.value)))
      );

    // Whether to include the selected cell.
    const includeSelected = !!this.data.data.find(
      (col) => !!col.find((cell) => cell.selected)
    );
    const range = maxValue - minValue;
    const scaleValue = (v: number) => (v - minValue) / range;

    if (this.layout.colorBar?.show) {
      const colorStops = d3.range(minValue, maxValue, range / 20);
      const { size, margin } = createSvg(undefined, this.layout);

      this.colorStopsSel = this.colorStopsSel
        ?.data(colorStops)
        .join("stop")
        .attr("offset", (d) => `${Math.round(scaleValue(d) * 100)}%`)
        .attr("stop-color", (d) => this.scaleColor(1 - scaleValue(d)));

      const tickmarkCount = this.layout.colorBar?.tickmarkCount ?? 5;
      const tickmarkInterval = (range * 1.0) / (tickmarkCount - 1);
      const tickmarks: number[] = [minValue];
      for (let i = 1; i < tickmarkCount - 1; i++) {
        tickmarks.push(Math.floor(minValue + tickmarkInterval * i));
      }
      tickmarks.push(maxValue);

      const calcY = (d: number, i: number) => {
        let result =
          (1 - (d - minValue) / range) *
          (size.height - margin.bottom - margin.top);
        if (i == 0) result -= 1;
        else if (i == tickmarkCount - 1) result += 1;

        return result;
      };

      this.colorStopValuesSel = this.colorStopValuesSel
        ?.data(tickmarks)
        .join("text")
        .attr("x", (size.width * (this.layout.colorBar?.width ?? 0)) / 100 ?? 0)
        .attr("y", calcY)
        .attr("dominant-baseline", (d, i) =>
          i === tickmarkCount - 1 ? "hanging" : "auto"
        )
        .attr("alignment-baseline", "middle")
        .style("font-size", "11px")
        .text((d) => d);

      this.tickmarkLinesSel = this.tickmarkLinesSel
        ?.data(tickmarks)
        .join("line")

        // Styling is applied based on defaults and the styling passed along with the data.
        .attr("x2", 6)
        .attr("y1", calcY)
        .attr("y2", calcY)
        .attr("stroke", "currentColor");
    }

    const onClickCell = (e: PointerEvent, cell: IHeatmapCell) => {
      switch (e.detail) {
        case 1:
          e.stopPropagation();
          this.notify("singleClickCell", cell);
          break;
        case 2:
          this.notify("doubleClickCell", cell);
          break;
      }
    };

    // Update the cells for the heatmap cells.
    this.cellsSel = this.cellsSel
      ?.data(this.data.data, (col, idx) => idx)
      .join("g")
      .attr(
        "transform",
        (col, idx) => `translate(${this.scaleX(idx.toString()) ?? 0},0)`
      )
      .each((cells, idx, column) => {
        // Update the cells for the heatmap cells.
        d3.select(column[idx])
          .selectAll<SVGAElement, IHeatmapCell>("rect")
          ?.data(cells, (c) => `cell-${c.id}`)
          .join("rect")
          .attr(
            "fill",
            (c) => c.style?.fillColor ?? this.scaleColor(scaleValue(c.value))
          )
          .attr(
            "opacity",
            (c) => `${!includeSelected || c.selected ? 100 : 50}%`
          )
          .attr("y", (c, i) => this.scaleY(i.toString()) ?? 0)
          .attr("width", this.scaleX.bandwidth())
          .attr("height", this.scaleY.bandwidth())
          .on("click", onClickCell);
      });

    // Update the texts for the heatmap cells.
    this.textsSel = this.textsSel
      ?.data(this.data.data, (col, idx) => idx)
      .join("g")
      .attr(
        "transform",
        (col, idx) => `translate(${this.scaleX(idx.toString()) ?? 0},0)`
      )
      .each((cells, idx, column) => {
        // Update the cells for the heatmap cells.
        d3.select(column[idx])
          .selectAll<SVGAElement, IHeatmapCell>("text")
          ?.data(cells, (c) => `cell-${c.id}`)
          .join("text")
          .attr("fill", (c) =>
            d3.hsl(
              c.style?.fillColor ??
                this.scaleColor(scaleValue(c.value)).toString()
            ).l >= 0.5
              ? "black"
              : "white"
          )
          .attr(
            "opacity",
            (c) => `${!includeSelected || c.selected ? 100 : 50}%`
          )
          .attr("y", (c, i) => this.scaleY(i.toString()) ?? 0)
          .attr("dx", this.scaleX.bandwidth() / 2)
          .attr("dy", this.scaleY.bandwidth() / 2)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .text((c) => c.label ?? c.value)
          .on("click", onClickCell);
      });
  }
}

export default HeatmapPlot;
export type {
  IHeatmapCell,
  IHeatmapPlotData,
  IHeatmapPlotLayout,
  IHeatmapPlotEvents,
};
