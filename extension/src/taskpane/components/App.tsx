// other possible globals are: require, console, Excel
// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* global require, fetch, console, Excel */

import * as React from "react";
import { Dropdown, Button, MessageBar, MessageBarType, } from "@fluentui/react";
// import Header from "./Header";
//import HeroList, { HeroListItem } from "./HeroList";
import Progress from "./Progress";
import Search from "./Search";
import { formatPostgrestQueryString, Group } from "../postgrest";
// import fetch

import type {
  /*JsonGroup, */
  Config,
  ImmutableTree,
  BuilderProps,
  AntdPosition,
} from "@react-awesome-query-builder/fluent";
import { Utils as QbUtils, Query, Builder, FluentUIConfig } from "@react-awesome-query-builder/fluent";
import "@react-awesome-query-builder/fluent/css/styles.css";

const dbTypeToFieldType = {
  int: "number",
  bigint: "number",
  decimal: "number",
  double: "number",
  integer: "number",
  float: "number",
  varchar: "text",
  text: "text",
  date: "date",
  datetime: "datetime",
};

// const useStyles = makeStyles({
//   multiselect: {
//     display: "flex",
//   },
// });
// const Multiselect = (props: Partial<DropdownProps>) => {
//   const styles = useStyles();
//   return (
//     <Dropdown multiselect={true} className={styles.multiselect} {...props}>
//       {props.children}
//     </Dropdown>
//   );
// };
// You need to provide your own config. See below 'Config format'
// tslint:disable-next-line: unknown-property

const pos: AntdPosition = "bottomLeft";
const operators = FluentUIConfig.operators;
const baseConfig = {
  ...FluentUIConfig,
  operators: {
    equal: { ...operators.equal },
    not_equal: { ...operators.not_equal },
    less: { ...operators.less },
    less_or_equal: { ...operators.less_or_equal },
    greater: { ...operators.greater },
    greater_or_equal: { ...operators.greater_or_equal },
    like: { ...operators.like },
    not_like: { ...operators.not_like },
    starts_with: { ...operators.starts_with },
    ends_with: { ...operators.ends_with },
  },
  settings: {
    ...FluentUIConfig.settings,
    maxNesting: 1,
    groupActionsPosition: pos,
    showNot: false,
  },
};

export interface AppProps {
  title: string;
  isOfficeInitialized: boolean;
  apiEndpoint: string;
}

export interface AppState {
  //listItems: HeroListItem[];
  tree: ImmutableTree;
  //config: Config;
  filterTypes: any;
  datasets: any[];
  selectedDataset: any;
  selectedDatasetSchema: any;
  selectedTable: any;
  disableSchemaTableSelect: boolean;
  selectedColumns: string[];
  errorMessage?: string;
}

function columnsToFields(columns) {
  const fields = {};
  columns.forEach((column) => {
    fields[column.name] = {
      label: column.name,
      type: dbTypeToFieldType[column.data_type.toLowerCase()] || "text",
    };
  });
  return fields;
}

function qualifyEndpoint(apiEndpoint, endpoint) {
  if (endpoint.startsWith("http")) return endpoint;
  return `${apiEndpoint}${endpoint}`;
}

function constructDatasetRequestUrl(apiEndpoint, dataset, schema, table, query?) {
  if (!dataset || !schema || !table) return null;
  return `${qualifyEndpoint(apiEndpoint, dataset.endpoint)}/${schema.name}/${table.name}${query}`;
}

export default class App extends React.Component<AppProps, AppState> {
  constructor(props, context) {
    super(props, context);
    //const queryValue: JsonGroup = { id: QbUtils.uuid(), type: "group" };
    this.state = {
      //tree: QbUtils.checkTree(QbUtils.loadTree(queryValue), config),
      tree: null,
      datasets: [],
      selectedDataset: null,
      selectedDatasetSchema: null,
      selectedTable: null,
      disableSchemaTableSelect: false,
      selectedColumns: [],
      filterTypes: {},
    };
  }

  componentDidMount = async () => {
    try {
      const datasets = await this.getAvailableDatasets();
      this.setState((prevState) => ({ ...prevState, datasets: datasets }));
    } catch (error) {
      this.setState((prevState) => ({ ...prevState, errorMessage: error.message }));
    }
  }

  getAvailableDatasets = async () => {
    const { apiEndpoint } = this.props;
    const response = await fetch(`${apiEndpoint}/`);
    const datasets = await response.json();
    return datasets;
  }

  loadDatasetSchema = async (dataset) => {
    if (dataset.schema) return;
    const { apiEndpoint } = this.props;
    const response = await fetch(`${qualifyEndpoint(apiEndpoint, dataset.endpoint)}/schema`);
    const datasetSchema = await response.json();
    dataset.schema = datasetSchema;
  }

  onFilterChange = (immutableTree: ImmutableTree, config: Config) => {
    this.setState((prevState) => ({ ...prevState, tree: immutableTree, config: config }));
    //const jsonTree = QbUtils.getTree(immutableTree);
  }

  onDatasetChange = async (_, item) => {
    const selectedDataset = item ? this.state.datasets.find((dataset) => dataset.name === item.key) : null;
    let disableSchemaTableSelect = false;
    let selectedDatasetSchema = null;
    let selectedTable = null;
    let filterTypes = {};
    if (selectedDataset) {
      await this.loadDatasetSchema(selectedDataset);
      if (selectedDataset.schema.schemas.length === 1 && selectedDataset.schema.schemas[0].objects.length === 1) {
        selectedDatasetSchema = selectedDataset.schema.schemas[0];
        selectedTable = selectedDatasetSchema.objects[0];
        disableSchemaTableSelect = true;
        filterTypes = columnsToFields(selectedTable.columns);
      }
    }
    this.setState((prevState) => ({
      ...prevState,
      selectedDataset,
      selectedDatasetSchema,
      selectedTable,
      disableSchemaTableSelect,
      filterTypes,
      selectedColumns: [],
    }));
  }

  importData = async (datasourceName: string, columns: string[], url: string) => {
    //const sheetName = datasourceName.substring(0, 31);
    const datasourceExcelName = datasourceName.replace(/[^a-zA-Z0-9]/g, "_");
    try {
      await Excel.run(async (context) => {
        // fetch data from the database using the REST api
        let response = await fetch(`${url}`);
        if (!response.ok) {
          const error = await response.json();
          const message = `API error: ${error.message}` || `HTTP error! status: ${response.status}`;
          throw new Error(message);
        }
        let data = await response.json();
        // create a new worksheet and table to display the data
        //context.workbook.worksheets.getItemOrNullObject(sheetName).delete();
        //const sheet = context.workbook.worksheets.add(sheetName.substring(0, 31));
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.load("id");
        await context.sync();
        const sheetId = sheet.id;
        const lastLetter = String.fromCharCode(65 + columns.length - 1);
        //let tbl = sheet.tables.add(`A1:${lastLetter}1`, true);
        const tableName = `${sheetId}_${datasourceExcelName}`.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 250);
        sheet.tables.getItemOrNullObject(tableName).delete();
        let tbl = sheet.tables.add(`A1:${lastLetter}1`, true);
        tbl.name = tableName;
        tbl.getHeaderRowRange().values = [columns];

        // the new data to the excel table
        if (data.length > 0) {
          const newData = data.map((item) => columns.map((column) => item[column]));
          tbl.rows.add(null, newData);
        }
        // const newData = data.map((item) => columns.map((column) => item[column]));
        // tbl.rows.add(null, newData);
        sheet.getUsedRange().format.autofitColumns();
        sheet.getUsedRange().format.autofitRows();
        sheet.activate();
        await context.sync();
      });
    } catch (error) {
      this.setState((prevState) => ({ ...prevState, errorMessage: error.message }));
    }
  }

  renderBuilder = (props: BuilderProps) => {
    return (
      <div className="query-builder-container">
        <div className="query-builder qb-lite">
          <Builder {...props} />
        </div>
      </div>
    );
  }
  
  render() {
    const { title, isOfficeInitialized } = this.props;
    if (!isOfficeInitialized) {
      return (
        <Progress
          title={title}
          logo={require("./../../../assets/logo-filled.png")}
          message="Please sideload your addin to see app body."
        />
      );
    }

    const {
      tree,
      datasets,
      selectedDataset,
      selectedDatasetSchema,
      selectedTable,
      disableSchemaTableSelect,
      selectedColumns,
      filterTypes,
      errorMessage,
    } = this.state;
    const { apiEndpoint } = this.props;
    //const url = this.constructDatasetRequestUrl(selectedDataset, selectedDatasetSchema, selectedTable, selectedColumns);
    const filter = QbUtils.queryBuilderFormat(tree, baseConfig) as Group;
    const query = !selectedTable
      ? undefined
      : formatPostgrestQueryString({
          select: selectedColumns,
          //table: selectedTable.name,
          filter,
        });
    const url = constructDatasetRequestUrl(apiEndpoint, selectedDataset, selectedDatasetSchema, selectedTable, query);
    const datasourceName = !selectedDataset
      ? ""
      : disableSchemaTableSelect
      ? selectedDataset.name
      : `${selectedDataset.name} - ${selectedTable.name}`;
    return (
      <div className="ms-welcome ms-bgColor-neutralLighter ms-u-fadeIn500">
        {/* <label htmlFor="dataset">Dataset</label> */}
        {/* <select id="dataset" onChange={this.onDatasetChange}>
          <option value="">Select a dataset</option>
          {datasets.map((dataset) => (
            <option key={dataset.name} value={dataset.name}>
              {dataset.name}
            </option>
          ))}
        </select> */}
        <Search endpoint={apiEndpoint} />
        <Dropdown
          id="dataset"
          label="Dataset"
          options={datasets.map((dataset) => ({ key: dataset.name, text: dataset.name }))}
          onChange={this.onDatasetChange}
          selectedKey={selectedDataset ? selectedDataset.name : undefined}
          placeholder="Select a dataset"
        />
        {selectedDataset && !disableSchemaTableSelect && (
          <div>
            {/* <label htmlFor="dataset_schema">Dataset Schema</label>
            <select
              id="dataset_schema"
              onChange={(event) => {
                const selectedDatasetSchema = selectedDataset.schema.schemas[event.target.selectedIndex - 1];
                this.setState((prevState) => ({ ...prevState, selectedDatasetSchema, selectedColumns: [] }));
              }}
            >
              <option value="">Select a dataset</option>
              {selectedDataset.schema.schemas.map((schema) => (
                <option key={schema.name} value={schema.name}>
                  {schema.name} ({schema.objects.length} tables)
                </option>
              ))}
            </select> */}
            <Dropdown
              id="dataset_schema"
              label="Dataset Schema"
              options={selectedDataset.schema.schemas.map((schema) => ({
                key: schema.name,
                text: `${schema.name} (${schema.objects.length} tables)`,
              }))}
              onChange={(_, option) => {
                const selectedDatasetSchema = selectedDataset.schema.schemas.find((schema) => schema.name === option.key);
                this.setState((prevState) => ({ ...prevState, selectedDatasetSchema, selectedColumns: [] }));
              }}  
              selectedKey={selectedDatasetSchema ? selectedDatasetSchema.name : undefined}
              placeholder="Select the schema"
            />
          </div>
        )}
        {selectedDatasetSchema && !disableSchemaTableSelect && (
          <div>
            {/* <label htmlFor="dataset_table">Dataset Table</label>
            <select
              id="dataset_table"
              onChange={(event) => {
                const selectedTable = selectedDatasetSchema.objects[event.target.selectedIndex - 1];
                const filterTypes = columnsToFields(selectedTable.columns);
                this.setState((prevState) => ({ ...prevState, selectedTable, filterTypes, selectedColumns: [] }));
              }}
            >
              <option value="">Select a table</option>
              {selectedDatasetSchema.objects.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.name}
                </option>
              ))}
            </select> */}
            <Dropdown
              id="dataset_table"
              label="Dataset Table"
              options={selectedDatasetSchema.objects.map((table) => ({ key: table.name, text: table.name }))}
              onChange={(_, option) => {
                const selectedTable = selectedDatasetSchema.objects.find((table) => table.name === option.key);
                const filterTypes = columnsToFields(selectedTable.columns);
                this.setState((prevState) => ({ ...prevState, selectedTable, filterTypes, selectedColumns: [] }));
              }}
              selectedKey={selectedTable ? selectedTable.name : undefined}
              placeholder="Select the table"
            />
          </div>
        )}
        {selectedTable && (
          <div>
            <div>
              <label htmlFor="dataset_columns">Columns</label>
              <Dropdown
                id="dataset_columns"
                multiSelect
                placeholder="Select columns"
                selectedKeys={selectedColumns}
                options={selectedTable.columns.map((column) => ({
                  key: column.name,
                  text: column.name,
                }))}
                onChange={(_, item) => {
                  if (item) {
                    const selectedItems = item.selected ? [...selectedColumns, item.key as string] : selectedColumns.filter((c) => c !== item.key);
                    this.setState((prevState) => ({ ...prevState, selectedColumns: selectedItems }));
                  }
                }}
              />
            </div>
            <div>
              <label>Filters</label>
              <Query
                {...baseConfig}
                fields={filterTypes}
                value={tree}
                onChange={this.onFilterChange}
                renderBuilder={this.renderBuilder}
              />
            </div>
          </div>
        )}
        {errorMessage && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={() => this.setState((prevState) => ({ ...prevState, errorMessage: undefined }))}
            dismissButtonAriaLabel="Close"
            truncated={true}
            overflowButtonAriaLabel="See more"
          >
            ${errorMessage}
          </MessageBar>
        )}
        {url && (
          <Button onClick={async () => await this.importData(datasourceName, selectedColumns, url)}>Import Data</Button>
        )}
      </div>
    );
  }
}
