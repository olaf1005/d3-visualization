import { Story, Meta } from "@storybook/html";
import { ViolinPlot, IViolinPlotData, IViolinPlotLayout } from "plots";

interface IViolinPlot {
  /** The data to supply the violin plot. */
  data?: IViolinPlotData;
  /** The layout to use for the line plot. */
  layout: IViolinPlotLayout;
}

export default {
  title: "Plots/Violin",
} as Meta<IViolinPlot>;

const Template: Story<IViolinPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  // Set up the line plot.
  const { data, layout } = args;

  const plot = new ViolinPlot(data, layout, container);

  plot.render();

  return container;
};

export const SimpleViolin = Template.bind({});
SimpleViolin.args = {
  data: {
    channels: [
      {
        id: "test",
        label: "label",
        values: ViolinPlot.generate(),
        showDistribution: true,
        showBoxplot: true,
        style: {
          strokeColor: "#4e79a7",
          fillColor: "#4e79a7",
          fillRadius: 2,
        },
      },
    ],
  },
  layout: {
    axes: {
      x: {
        label: "Simple Violin-X",
      },
      y: {
        label: "Simple Violin-Y",
      },
    },
  },
};
