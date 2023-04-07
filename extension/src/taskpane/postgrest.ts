export type Value = {
  type: string;
  value: string;
};

export type Rule = {
  id: string;
  fieldName: string;
  type: string;
  operator: string;
  values: Value[];
};

export type Group = {
  condition: string;
  rules: Array<Rule | Group>;
};

export type QueryBuilderJson = {
  //table: string;
  select?: string[];
  filter?: Group;
  //order?: Record<string, "asc" | "desc">;
  //limit?: number;
  //offset?: number;
};

const operatorMap: Record<string, Function> = {
  equal: (value) => ["eq", value],
  not_equal: (value) => ["not.eq", value],
  less: (value) => ["lt", value],
  less_or_equal: (value) => ["lte", value],
  greater: (value) => ["gt", value],
  greater_or_equal: (value) => ["gte", value],
  like: (value) => ["like", `*${value}*`],
  not_like: (value) => ["not.like", `*${value}*`],
  starts_with: (value) => ["like", `${value}*`],
  ends_with: (value) => ["like", `*${value}`],
  // between,
  // not_between,
  // is_null: "is",
  // is_not_null: "not.is",
  // is_empty,
  // is_not_empty,
  // select_equals, // like `equal`, but for select
  // select_not_equals,
  // select_any_in,
  // select_not_any_in,
  // multiselect_contains,
  // multiselect_not_contains,
  // multiselect_equals, // like `equal`, but for multiselect
  // multiselect_not_equals,
  // proximity, // complex operator with options
};

function formatRule(rule: Rule): string {
  //const postgrestOperator = operatorMap[rule.operator] || rule.operator;
  const [o, v] = operatorMap[rule.operator](rule.values[0].value);
  return `${encodeURIComponent(rule.fieldName)}.${o}."${encodeURIComponent(v)}"`;
}

function formatGroup(group: Group, del = ""): string {
  const conditions = group.rules.map((ruleOrGroup) => formatRuleOrGroup(ruleOrGroup));
  return `${group.condition.toLowerCase()}${del}(${conditions.join(",")})}`;
}
function formatRuleOrGroup(ruleOrGroup: Group | Rule): string {
  if ("condition" in ruleOrGroup) {
    return formatGroup(ruleOrGroup as Group);
  } else {
    const rule = ruleOrGroup as Rule;
    return formatRule(rule);
  }

  // group.rules.forEach((ruleOrGroup) => {
  //   if ("condition" in ruleOrGroup) {
  //     conditions.push(formatGroup(ruleOrGroup, prefix + "_"));
  //   } else {
  //     const rule = ruleOrGroup as Rule;
  //     conditions.push(formatRule(rule, prefix));
  //   }
  // });

  //return conditions.join(`${conditions.toLowerCase()}(${conditions.join(",")})`);
}

export function formatPostgrestQueryString(query: QueryBuilderJson): string {
  let queryString = "";

  //queryString += query.table;
  const parameters = [];

  if (query.select && query.select.length) {
    parameters.push(`select=${query.select.map((s) => `"${encodeURIComponent(s)}"`).join(",")}`);
  }

  if (query.filter) {
    const filterString = formatGroup(query.filter, "=");
    if (filterString) {
      parameters.push(filterString);
    }
  }

  // if (query.order) {
  //   for (const key in query.order) {
  //     if (query.order.hasOwnProperty(key)) {
  //       const value = query.order[key];
  //       queryString += `&order=${encodeURIComponent(key)}.${encodeURIComponent(value)}`;
  //     }
  //   }
  // }

  // if (query.limit) {
  //   queryString += `&limit=${encodeURIComponent(query.limit)}`;
  // }

  // if (query.offset) {
  //   queryString += `&offset=${encodeURIComponent(query.offset)}`;
  // }

  if (parameters.length) {
    queryString += `?${parameters.join("&")}`;
  }
  return queryString;
}

// Example usage:
// const queryBuilderJson: QueryBuilderJson = {
//   table: "users",
//   select: ["id", "name", "email"],
//   // order: {
//   //   id: "asc",
//   // },
//   // limit: 10,
//   // offset: 0,
//   filter: {
//     condition: "AND",
//     rules: [
//       {
//         id: "1",
//         field: "role",
//         type: "string",
//         input: "text",
//         operator: "eq",
//         value: "admin",
//       },
//       {
//         id: "2",
//         field: "active",
//         type: "boolean",
//         input: "checkbox",
//         operator: "eq",
//         value: true,
//       },
//     ],
//   },
// };

//const postgrestQueryString = formatPostgrestQueryString(queryBuilderJson);
//console.log(postgrestQueryString); // Output: /users?select=id,name,email&role_eq.admin&AND=active_eq.true&order=id.asc&limit=10&offset=0
