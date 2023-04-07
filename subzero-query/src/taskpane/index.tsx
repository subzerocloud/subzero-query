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
/* global document, Office, module, require */

initializeIcons();

let isOfficeInitialized = false;

const title = "Contoso Task Pane Add-in";

const render = (Component) => {
  ReactDOM.render(
    // <AppContainer>
    <ThemeProvider theme={customTheme} style={{ backgroundColor: "transparent" }}>
      <Component title={title} isOfficeInitialized={isOfficeInitialized} />
    </ThemeProvider>,
    // </AppContainer>,
    document.getElementById("container")
  );
};

/* Render application after Office initializes */
Office.onReady(() => {
  isOfficeInitialized = true;
  render(App);
});

//if ((module as any).hot) (module as any).hot.accept;

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    render(NextApp);
  });
}
