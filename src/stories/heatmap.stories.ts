import { Story, Meta } from "@storybook/html";
import {
  IHeatmapCell,
  IHeatmapPlotData,
  IHeatmapPlotLayout,
  HeatmapPlot,
} from "plots";

interface IHeatmapPlot {
  /** The data to supply the Heatmap plot. */
  data?: IHeatmapPlotData<IHeatmapCell>;
  /** The layout to use for the Heatmap plot. */
  layout?: IHeatmapPlotLayout;
}

export default {
  title: "Plots/Heatmap",
} as Meta<IHeatmapPlot>;

const Template: Story<IHeatmapPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  // Set up the Heatmap plot.
  const { data, layout } = args;

  const plot = new HeatmapPlot(data, layout, container);
  plot
    .on("singleClickCell", (bin) => {
      bin.selected = !bin.selected;
      plot.render();
    })
    .on("clickSpace", () => {
      plot.data.data.forEach((col) => col.forEach((c) => (c.selected = false)));
      plot.render();
    });
  plot.render();

  return container;
};

let data: IHeatmapCell[][] = [];

export const SimpleHeatmap = Template.bind({});
for (let x = 0; x < 20; x++) {
  data[x] = [];
  for (let y = 0; y < 20; y++) {
    data[x][y] = {
      id: `${x}-${y}`,
      value: Math.floor(Math.random() * 100),
      label: "",
    };
  }
}
SimpleHeatmap.args = {
  data: {
    data: data,
  },
  layout: {
    colorBar: {
      tickmarkCount: 10,
    },
  },
};

export const ChessBoardHeatmap = Template.bind({});
data = [];
for (let x = 0; x < 8; x++) {
  data[x] = [];
  for (let y = 0; y < 8; y++) {
    const cellValue = (x + y) % 2;
    data[x][y] = {
      id: `${x}-${y}`,
      value: cellValue,
      label: "",
      style: {
        fillColor: cellValue == 1 ? "black" : "white",
        strokeWidth: 0,
      },
    };
  }
}
ChessBoardHeatmap.args = {
  data: {
    data: data,
  },
  layout: {
    colorBar: {
      show: false,
    },
    axes: {
      x: {
        label: "Chess Board",
      },
    },
    groups: {
      x: {
        labels: ["A", "B", "C", "D", "E", "F", "G", "H"],
      },
      y: {
        labels: ["1", "2", "3", "4", "5", "6", "7", "8"],
      },
    },
  },
};

export const SmoothHeatmap = Template.bind({});
data = [];
for (let x = 0; x < 50; x++) {
  data[x] = [];
  for (let y = 0; y < 50; y++) {
    const cellValue =
      Math.sin((2 * Math.PI * x) / 50) * Math.sin((2 * Math.PI * y) / 50);
    data[x][y] = {
      id: `${x}-${y}`,
      value: cellValue,
      label: "",
    };
  }
}
SmoothHeatmap.args = {
  data: {
    data: data,
    colormap: "rainbow",
  },
  layout: {
    colorBar: {
      show: false,
    },
    axes: {
      x: {
        label: "Smooth Heatmap",
      },
    },
  },
};

let interval: NodeJS.Timer | undefined = undefined;

const countries = [
  "Argentina",
  "Australia",
  "Austria",
  "Brazil",
  "Denmark",
  "England",
  "France",
  "Germany",
  "Italy",
  "Mexico",
  "Netherland",
  "Norway",
  "Portugal",
  "Spain",
];

const bitcoins = [
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "BNB",
  "BUSD",
  "XRP",
  "ADA",
  "SOL",
  "DOGE",
  "DOT",
  "MATIC",
  "AVAX",
  "SHIB",
  "TRX",
  "UNI",
  "WBTC",
];

const RealtimeTemplate: Story<IHeatmapPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  // Set up the Donut plot.
  const { layout } = args;

  const data: IHeatmapPlotData = {
    data: bitcoins.map((bitcoin) =>
      countries.map((country) => ({
        id: `${bitcoin}-${country}`,
        value: 0,
      }))
    ),
    colormap: "greens",
  };
  const plot = new HeatmapPlot(data, layout, container);
  plot
    .on("singleClickCell", (bin) => {
      bin.selected = !bin.selected;
      plot.render();
    })
    .on("clickSpace", () => {
      plot.data.data.forEach((col) => col.forEach((c) => (c.selected = false)));
      plot.render();
    });
  plot.render();

  let values: number[][];
  values = Array(bitcoins.length).fill(
    Array(countries.length)
      .fill(0)
      .map((_, k) => 1 + Math.sin(k / 5))
  );
  const valuesSum = values.reduce(
    (x, y) => x + y.reduce((y0, y1) => y0 + y1, 0),
    0
  );
  values = values.map((x) => x.map((y) => (y /= valuesSum)));

  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }

  const xIndex = (i: number) => Math.floor(i / countries.length);
  const yIndex = (i: number) => i % countries.length;

  interval = setInterval(() => {
    let rand = Math.random();
    let index = 0;
    while (rand > values[xIndex(index)][yIndex(index)]) {
      index++;
      rand -= values[xIndex(index)][yIndex(index)];
    }
    if (data.data[xIndex(index)][yIndex(index)]) {
      data.data[xIndex(index)][yIndex(index)].value++;
    }

    plot.data = data;
    plot.render();
  }, 50);

  return container;
};

export const RealtimeHeatmap = RealtimeTemplate.bind({});
RealtimeHeatmap.args = {
  layout: {
    axes: {
      x: {
        label: "Bitcoin Depositing",
      },
    },
    groups: {
      x: {
        labels: bitcoins,
      },
      y: {
        labels: countries,
      },
    },
  },
};

const ThermalTemplate: Story<IHeatmapPlot> = (args) => {
  // Construct the container.
  const container = document.createElement("div");
  container.className = "plot-container";

  // Set up the Donut plot.
  const { layout } = args;
  // Initiate Data
  const cellData: IHeatmapCell[][] = [];
  const resolution = 50;
  const thermalResources = [20, 60, 80, 90];
  const conductivity = 0.1;
  let cellValue = 0;
  for (let x = 0; x < resolution; x++) {
    cellData[x] = [];
    for (let y = 0; y < resolution; y++) {
      //Boundaries of plane
      if (x == 0) {
        //left
        cellValue = thermalResources[0];
      } else if (x == resolution - 1) {
        //Right
        cellValue = thermalResources[2];
      } else if (y == 0) {
        //Up
        cellValue = thermalResources[1];
      } else if (y == resolution - 1) {
        //Down
        cellValue = thermalResources[3];
      } else {
        //inner cold space
        cellValue = 0;
      }
      cellData[x][y] = {
        id: `${x}-${y}`,
        value: cellValue,
        label: "",
      };
    }
  }

  const plot = new HeatmapPlot(
    {
      data: cellData,
      colormap: "inferno",
    },
    layout,
    container
  );
  plot
    .on("singleClickCell", (bin) => {
      bin.selected = !bin.selected;
      plot.render();
    })
    .on("clickSpace", () => {
      plot.data.data.forEach((col) => col.forEach((c) => (c.selected = false)));
      plot.render();
    });
  plot.render();

  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }

  interval = setInterval(() => {
    for (let x = 1; x < resolution - 1; x++) {
      for (let y = 1; y < resolution - 1; y++) {
        cellData[x][y].value =
          conductivity *
            (cellData[x + 1][y].value +
              cellData[x - 1][y].value +
              cellData[x][y + 1].value +
              cellData[x][y - 1].value -
              4 * cellData[x][y].value) +
          cellData[x][y].value;
      }
    }
    plot.data = { data: cellData, colormap: "inferno" };
    plot.render();
  }, 50);

  return container;
};
export const ThermalConductivity = ThermalTemplate.bind({});
ThermalConductivity.args = {
  layout: {
    axes: {
      x: {
        label: "Thermal Heatmap",
      },
    },
  },
};
