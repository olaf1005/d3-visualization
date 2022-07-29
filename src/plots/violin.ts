import * as d3 from "d3";
import { IPlotLayout, IPlotStyle, PlotWithAxis, Selection } from "types";
import { createSvg } from "utility";

interface IViolinChannel {
  /** A unique identifier for a violin channel. */
  id: string;

  /** The label to assign to the channel. */
  label?: string;
  /** The values recorded in the channel. */
  values: number[];

  /** Whether to show the estimated probability distribution. */
  showDistribution?: boolean;
  /** Whether to show the boxplot for the points. */
  showBoxplot?: boolean;

  /** The optional styles to apply to the channel. */
  style?: IPlotStyle;
}

interface IViolinPlotData {
  /** The channels that make up the violin plot. */
  channels: IViolinChannel[];
}

/** Represents the layout information for the plot. */
interface IViolinPlotLayout extends IPlotLayout<"violin"> {}

/** The events that may be emitted from a violin plot. */
interface IViolinPlotEvents {
  /** An event listener that is called when a point is called exactly once (does not fire on double click). */
  singleClickPoint: (bin: IViolinChannel) => void;
  /** An event listener that is called when a point is clicked exactly twice (does not fire on single click). */
  doubleClickPoint: (bin: IViolinChannel) => void;
  /** An event listener that is called when the empty space is clicked. */
  clickSpace: () => void;
}

/**
 * An object that persists, renders, and handles information about a violin plot.
 */
class ViolinPlot extends PlotWithAxis<
  IViolinPlotData,
  IViolinPlotLayout,
  IViolinPlotEvents
> {
  // #region DOM
  private curveSels?: Selection<SVGGElement, unknown, HTMLElement>[] = [];
  private dotsSels?: Selection<SVGGElement, number, SVGGElement>[] = [];
  private boxplotSels?: Selection<SVGGElement, unknown, HTMLElement>[] = [];
  // #endregion

  public static generate = (baseNumber = 500, count = 800) => {
    const spread = d3.randomUniform(10, 50)();
    const center = d3.randomNormal(baseNumber, spread)();
    const jitter = d3.randomUniform(10, 100);
    const direction = () => (Math.random() > 0.5 ? 1 : -1);
    const base = d3.randomNormal(center, spread);
    const random = () => Math.round(base() + jitter() * direction());
    const data = Array.from({ length: count })
      .fill(null)
      .map(random)
      .sort(d3.ascending);
    return data;
  };

  /**
   * Constructs a new violin plot.
   * @param data Data to be plotted. Optional.
   * @param layout Layout information to be used. Optional.
   * @param container THe container to hold the plot. Optional.
   */
  public constructor(
    data?: IViolinPlotData,
    layout?: IViolinPlotLayout,
    container?: HTMLElement
  ) {
    super(data, layout, container);

    // Set the data.
    this._container = container;
    this._layout = layout ?? {};
    this._data = data ?? { channels: [] };

    // Perform setup tasks.
    this.setupElements();
    this.setupScales();
  }

  /**
   * Get the min and max simultaneously on x-axis from the data array to plot.
   * @param data The data array to plot.
   * @returns The min and max simultaneously.
   */
  private extentX(data: IViolinPlotData) {
    const numbers: number[] = [];
    data.channels.forEach((e) => {
      numbers.push(...e.values);
    });

    return d3.extent(numbers);
  }

  /**
   * Get the min and max simultaneously on y-axis from the data array to plot.
   * @param data The data array to plot.
   * @returns The min and max simultaneously.
   */
  private extentY(data: IViolinPlotData) {
    const threshold = 20;
    const numbers: number[] = [];
    data.channels.forEach((e) => {
      d3.bin()
        .thresholds(threshold)(e.values)
        .map((bin) => numbers.push(bin.length));
    });

    return d3.extent(numbers);
  }

  /** Initializes the scales used to transform data for the violin plot. */
  private setupScales() {
    // Get the metrics for the SVG element.
    const { size, margin } = createSvg(undefined, this.layout);

    // Find the range of values.
    const extentX = this.extentX(this._data);
    const extentY = this.extentY(this._data);

    // Create the scalars for the data.
    this.scaleX = d3
      .scaleLinear()
      .domain([
        this.layout.axes?.x?.minimum ?? extentX[0] ?? 0,
        this.layout.axes?.x?.maximum ?? extentX[1] ?? 1,
      ])
      .range([margin.left, size.width - margin.right]);
    const minValue = this.layout.axes?.y?.minimum ?? extentY[1] ?? 0;
    const maxValue = this.layout.axes?.y?.maximum ?? extentY[1] ?? 1;
    this.scaleY = d3
      .scaleLinear()
      .domain([-minValue, maxValue])
      .range([size.height - margin.bottom, margin.top]);
  }

  /** Initializes the elements for the violin plot. */
  private setupElements() {
    if (this.container) {
      // Create the SVG element.
      const { svg, size, margin } = createSvg(this.container, this.layout);

      this.svgSel = svg;
      this.svgSel.on("click", (event) => {
        if (event.target === event.currentTarget) this.notify("clickSpace");
      });

      this.contentSel = this.svgSel.append("g");

      // Setup the zoom behavior.
      if (this.zoomExt) {
        this.svgSel
          .call(this.zoomExt)
          .call(this.zoomExt.transform, d3.zoomIdentity);
      }

      // Create the violin plot elements.
      this._data.channels.forEach(() => {
        const plot = this.contentSel?.append("g");
        const gap = 10;

        if (plot) {
          this.curveSels?.push(plot.append("g"));
          this.dotsSels?.push(
            plot
              .append("g")
              .attr(
                "transform",
                `translate(0,${
                  (size.height - margin.bottom - margin.top) / 2 +
                  margin.top +
                  gap
                })`
              )
              .selectAll("circle")
          );

          this.boxplotSels?.push(
            plot
              ?.append("g")
              .attr(
                "transform",
                `translate(0,${
                  (size.height - margin.bottom - margin.top) / 2 - gap
                })`
              )
          );
        }
      });

      this.setupAxisElements();
    }
  }

  // #region Zooming
  /** Zooms the plot to fit all of the data within the viewbox. */
  public zoomToFit() {
    // Get the size of the SVG element.
    if (!this.contentSel) return;

    const { size } = createSvg(undefined, this.layout);

    // Get the bounds of the data.
    const xExtent = this.extentX(this._data);
    const yExtent = this.extentY(this._data);
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
                Math.max(
                  (xMax - xMin) / size.width,
                  (yMax - yMin) / size.height
                )
            )
            .translate(-(xMin + xMax) / 2, -(yMin + yMax) / 2)
        );
    }
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
  public get layout(): IViolinPlotLayout {
    return { ...super.layout };
  }
  public set layout(value: IViolinPlotLayout) {
    super.layout = value;
    this.setupScales();

    // Update the features dependent on layout.
    if (this.svgSel) {
      const { viewBox, style } = createSvg(undefined, value);
      this.svgSel.attr("viewBox", viewBox).attr("style", style);
    }
  }
  public get data(): IViolinPlotData {
    return super.data;
  }
  public set data(value: IViolinPlotData) {
    super.data = value;
    this.setupScales();
  }
  // #endregion

  private area(channel: IViolinChannel, histogram: [number, number][]) {
    // Get the metrics for the SVG element.
    const { size, margin } = createSvg(undefined, this.layout);

    const x = d3
      .scaleLinear()
      .domain([0, histogram.length])
      .range([margin.left, size.width - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(histogram.map((d) => d[1])) as number])
      .range([margin.top + (size.height - margin.bottom - margin.top) / 2, 0]);

    const area = d3
      .area()
      .y0((d) => y(d[1]))
      .y1(margin.top + (size.height - margin.bottom - margin.top) / 2)
      .x((d, i) => x(i))
      .curve(d3.curveBasis);

    return area;
  }

  private drawCurve(channel: IViolinChannel, index: number) {
    const threshold = 20;
    const histogram = d3
      .bin()
      .thresholds(threshold)(channel.values)
      .map((bin, index) => [index, bin.length]);

    const area = this.area(channel, histogram as [number, number][]);

    if (this.curveSels) {
      this.curveSels[index]
        .append("path")
        .attr("d", area(histogram as [number, number][]))
        .attr("fill", channel.style?.fillColor ?? "none")
        .attr("opacity", 0.3);
    }
  }

  private drawBoxplot(channel: IViolinChannel, index: number) {
    const bar = 20;
    if (this.boxplotSels) {
      const plot = this.boxplotSels[index];
      plot
        ?.append("line")
        .attr("x1", this.scaleX(d3.quantile(channel.values, 0.5) as number))
        .attr("x2", this.scaleX(d3.quantile(channel.values, 0.5) as number))
        .attr("y1", 0)
        .attr("y2", bar)
        .attr("stroke-width", channel.style?.strokeWidth ?? 1)
        .attr("stroke", channel.style?.strokeColor ?? "none");

      plot
        ?.append("line")
        .attr("x1", this.scaleX(d3.quantile(channel.values, 0.01) as number))
        .attr("x2", this.scaleX(d3.quantile(channel.values, 0.25) as number))
        .attr("y1", bar * 0.5)
        .attr("y2", bar * 0.5)
        .attr("stroke-width", channel.style?.strokeWidth ?? 1)
        .attr("stroke", channel.style?.strokeColor ?? "none");

      plot
        ?.append("line")
        .attr("x1", this.scaleX(d3.quantile(channel.values, 0.99) as number))
        .attr("x2", this.scaleX(d3.quantile(channel.values, 0.75) as number))
        .attr("y1", bar * 0.5)
        .attr("y2", bar * 0.5)
        .attr("stroke-width", channel.style?.strokeWidth ?? 1)
        .attr("stroke", channel.style?.strokeColor ?? "none");

      plot
        ?.append("rect")
        .attr("x", this.scaleX(d3.quantile(channel.values, 0.25) as number))
        .attr("y", 0)
        .attr("height", bar)
        .attr(
          "width",
          this.scaleX(d3.quantile(channel.values, 0.75) as number) -
            this.scaleX(d3.quantile(channel.values, 0.25) as number)
        )
        .attr("stroke-width", channel.style?.strokeWidth ?? 1)
        .attr("stroke", channel.style?.strokeColor ?? "none")
        .attr(
          "fill",
          channel.style?.fillColor ? channel.style?.fillColor + "00" : "none"
        );
    }
  }

  private drawDots(channel: IViolinChannel, index: number) {
    // Get the metrics for the SVG element.
    const { size, margin } = createSvg(undefined, this.layout);

    if (this.dotsSels) {
      this.dotsSels[index] = this.dotsSels[index]
        .data(channel.values)
        .join("circle")
        .attr("r", channel.style?.fillRadius ?? 2)
        .attr("cx", (d) => this.scaleX(d))
        .attr(
          "cy",
          () =>
            ((Math.random() * (size.height - margin.bottom - margin.top)) / 2) *
            0.5
        )
        .attr("fill", channel.style?.fillColor ?? "none");
    }
  }

  /** Renders a plot of the graph. */
  public render() {
    this._data.channels.forEach((channel, index) => {
      // Curve
      this.drawCurve(channel, index);

      // boxplot
      if (channel.showBoxplot) {
        this.drawBoxplot(channel, index);
      }

      // dots
      if (channel.showDistribution) {
        this.drawDots(channel, index);
      }
    });
  }
}

export default ViolinPlot;
export type {
  IViolinChannel,
  IViolinPlotData,
  IViolinPlotLayout,
  IViolinPlotEvents,
};
