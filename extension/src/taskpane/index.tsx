import App from "./components/App";
//import { AppContainer } from "react-hot-loader";
import { initializeIcons } from "@fluentui/font-icons-mdl2";
import { ThemeProvider, Theme, } from "@fluentui/react";
import { Fluent2WebLightTheme as theme } from "@fluentui/fluent2-theme";
import * as React from "react";
import * as ReactDOM from "react-dom";
import "./taskpane.css";
const customTheme: Theme = {
  ...theme
};

initializeIcons();

let isOfficeInitialized = false;
let apiEndpoint = '';

const title = "subZero Query Add-in";

const render = (Component) => {
  ReactDOM.render(
    // <AppContainer>
    <ThemeProvider theme={customTheme} style={{ backgroundColor: "transparent" }}>
      <Component title={title} isOfficeInitialized={isOfficeInitialized} apiEndpoint={apiEndpoint} />
    </ThemeProvider>,
    // </AppContainer>,
    document.getElementById("container")
  );
};

/* Render application after Office initializes */
Office.onReady(() => {
  isOfficeInitialized = true;
  Excel.run(async (context) => {
    const settings = context.workbook.settings;
    let apiEndpointSetting = settings.getItemOrNullObject("subzeroApiEndpoint");
    await context.sync();
    if(apiEndpointSetting.isNullObject) {
      settings.add("subzeroApiEndpoint", global.defaultApiEndpoint);
      apiEndpointSetting = settings.getItem("subzeroApiEndpoint");
    }
    apiEndpointSetting.load("value");
    await context.sync();
    apiEndpoint = apiEndpointSetting.value;
    
    render(App);
  }).catch(function (error) {
    console.error("app init error", error);
  });
});

//if ((module as any).hot) (module as any).hot.accept;

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    render(NextApp);
  });
}
