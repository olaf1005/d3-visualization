import { Story, Meta } from "@storybook/html";
import { ViolinPlot, IViolinPlotData, IViolinPlotLayout } from "plots";

interface IViolinPlot {
  /** The data to supply the violin plot. */
  data?: IViolinPlotData;
  /** The layout to use for the violin plot. */
  layout: IViolinPlotLayout;
}

export default {
  title: "Plots/Violin",
} as Meta<IViolinPlot>;

const Template: Story<IViolinPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  // Set up the violin plot.
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

let interval: NodeJS.Timer | undefined = undefined;

const RealtimeTemplate: Story<IViolinPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  let i = 0;
  const limitPoints = 1000;
  const addNewValue = (data: IViolinPlotData) => {
    // Generate random number between 300 and 700
    const randomNumber = 300 + Math.random() * (700 - 300);
    if (data.channels[0].values.length >= limitPoints) {
      data.channels[0].values.shift();
    }
    data.channels[0].values.push(randomNumber);
  };

  // Set up the line plot.
  const dataChannel: IViolinPlotData = {
    channels: [
      {
        id: "test",
        label: "label",
        values: [],
        showDistribution: true,
        showBoxplot: true,
        style: {
          strokeColor: "#e15759",
          fillColor: "#e15759",
          fillRadius: 2,
        },
      },
    ],
  };

  for (i = 0; i < 10; i++) {
    addNewValue(dataChannel);
  }

  const { layout } = args;
  const plot = new ViolinPlot(dataChannel, layout, container);

  plot.render();

  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }

  interval = setInterval(() => {
    addNewValue(dataChannel);
    plot.data = dataChannel;
    plot.render();
  }, 500);

  return container;
};

export const RealtimeViolin = RealtimeTemplate.bind({});
RealtimeViolin.args = {
  layout: {
    axes: {
      x: {
        label: "Realtime Violin-X",
      },
      y: {
        label: "Realtime Violin-Y",
      },
    },
  },
};
