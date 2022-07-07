import "@logseq/libs";
import { clearDriftless, setDriftlessTimeout } from "driftless";
import Fuse from "fuse.js";

const settings = [
  {
    key: "PathToBBT",
    title: "Path to Better BibTeX file (required)",
    description: "This is the path to the Better BibTeX JSON file on your computer. Please see the README for more information on how to download the file",
    type: "string",
    default: ""
  },
  {
    key: "PageTitleTemplate",
    title: "Template for the new Zotero page title (required)",
    description: "This is the template that will be used as the new Zotero page's title. Please see the README for the available variables (e.g. {{authors}} ({{year}}) {{title}})",
    type: "string",
    default: ""
  },
  {
    key: "PagePropertiesTemplate",
    title: "Template for properties in the new Zotero page (optional)",
    description: "This is the template that will be used as the properties in the new Zotero page. Please see the README for the list of variables and separate each property with a comma (e.g. {{pdf}}, {{pages}}, {{url}})",
    type: "string",
    default: ""
  },
  {
    key: "CustomPageProperties",
    title: "Custom properties in the new Zotero page (optional)",
    description: "These are custom properties that will be included in the new Zotero page after the Zotero properties. Each property key can have more than 1 value (e.g. tags:: tag1, tag2, tag3). To include more than 1 property, separate each property with a semi-colon (e.g. category:: zotero, reading-list; status:: to-read). Leave the property value empty if you want to fill it in yourself later (e.g. rating::)",
    type: "string",
    default: ""
  },
  {
    key: "KeyboardShortcut",
    title: "Keyboard shortcut to bring up the Logtero search bar",
    description: "This is the keyboard shortcut to bring up the Logtero search bar (default: mod+alt+z - Mac: cmd+alt+z | Windows: ctrl+alt+z)",
    type: "string",
    default: "mod+alt+z"
  }
]
logseq.useSettingsSchema(settings);
const search_bar = document.getElementById("search-bar");
let search_results = document.getElementById("search-results");
let input_type;
let typingTimer;
let search_index = 0;
let filtered_search;
let selected_search_item;
let zotero_library_collections;
let zotero_library_items;
let zotero_search_results;
let filtered_zotero_search_results;
let selected_zotero_item_citekey = "";
let zotero_authors = "";
let zotero_year = "";

// ref to display zotero results after there's no more typing: https://stackoverflow.com/questions/4220126/run-javascript-function-when-user-finishes-typing-instead-of-on-key-up (user: Grace.io)
search_bar.addEventListener("input", () => {
  clearSearchResults();
  clearDriftless(typingTimer);
  typingTimer = setDriftlessTimeout(() => searchZoteroItems("search"), 750);
});

// FIX: use arrow keys to go up/down the search results list
// refs:
// https://codepen.io/mehuldesign/pen/eYpbXMg?editors=0100
// https://stackoverflow.com/questions/33790668/arrow-keys-navigation-through-li-no-jquery
// https://stackoverflow.com/questions/8902787/navigate-through-list-using-arrow-keys-javascript-jq

search_bar.addEventListener("keydown", function (e) {
  // remove all search results when the search bar is empty
  if ((e.key == "Backspace") && (search_bar.value == "")) {
    clearSearchResults();
  }

  // down arrow
  else if (e.key == "ArrowDown") {
    if (search_results.children.length > 0) {
      if (search_index == 0) {
        document.getElementById(filtered_search[0].id).classList.add("selected");
        search_index++;
      }
      else {
        if (search_index != (filtered_search.length - 1)) {
          document.querySelector(".selected").classList.remove("selected");
          document.getElementById(filtered_search[search_index].id).classList.add("selected");

          search_index++;
        }
      }
    }
  }

  // up arrow
  else if (e.key == "ArrowUp") {
    if (search_results.children.length > 0) {
      if (search_index != 0) {
        if (search_index != (filtered_search.length - 1)) {
          search_index--;

          document.querySelector(".selected").classList.remove("selected");
          document.getElementById(filtered_search[search_index].id).classList.add("selected");
        }
      }
    }
  }

  // enter
  else if (e.key == "Enter") {
    selected_search_item = document.querySelector(".selected").id;
    getZoteroItems(0.0, ["citekey"], selected_search_item, "create");
    exitSearch();
  }
});

function getZoteroItems(threshold, keys, search_input, type) {
  // ref for fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#uploading_json_data
  const BBT_path = logseq.settings.PathToBBT;
  
  fetch(`${BBT_path}`).then(response =>
    response.json()).then(zotero_library => {
      zotero_library_collections = zotero_library.collections;
      zotero_library_items = zotero_library.items;

      // use fuse.js to search for zotero items
      const options = {
        threshold: threshold,
        keys: keys,
        distance: 1000
      };
      const fuse = new Fuse(zotero_library_items, options);
      zotero_search_results = fuse.search(search_input);

      (type == "search") ? searchZoteroItems(zotero_search_results) : createZoteroPage(zotero_search_results[0].item);
    }).catch((error) => {
      console.error("Logtero: Error", error);
    });
}

function searchZoteroItems(e) {
  let zotero_item;
  let zotero_item_citeKey;
  let zotero_item_title;
  let search_result_item;
  let search_result_title_container;
  let search_result_title;
  let search_result_description_container;
  let search_result_description;

  if (logseq.settings.PathToBBT != "") {
    if (typeof(e) == "string") {
      getZoteroItems(0.2, ["title", "creators.lastName"], search_bar.value, "search");
    }
    else {
      filtered_zotero_search_results = e;
      
      if (filtered_zotero_search_results.length > 0) {
        // display filtered zotero items
        for (let i = 0; i < filtered_zotero_search_results.length; i++) {
          zotero_item = filtered_zotero_search_results[i].item;
          
          zotero_item_citeKey = zotero_item.citekey;
          zotero_item_title = zotero_item.title;
        
          // format zotero authors
          formatZoteroAuthors(zotero_item.creators, "condense");

          // format zotero year
          formatZoteroDate(zotero_item.date);

          // ref to create and append new elements: https://stackoverflow.com/questions/20673959/how-to-add-new-li-to-ul-onclick-with-javascript
          const hr = document.createElement("hr");
          
          search_result_item = document.createElement("li");
          search_result_item.id = zotero_item_citeKey;

          search_result_title_container = document.createElement("div");
          search_result_title = document.createTextNode(`${zotero_item_title}`);
          
          search_result_description_container = document.createElement("div");
          search_result_description = document.createTextNode(`${zotero_authors} (${zotero_year})`);
          
          // add class and/or styles
          setAttributes(search_result_item, {
            "class": "search-result",
            "style": "cursor: pointer;"
          });
          setAttributes(search_result_title_container, {
            "class": "title"
          });
          setAttributes(search_result_description_container, {
            "class": "info"
          });

          search_result_item.addEventListener("click", function (e) {
            exitSearch();
            createZoteroPage(e);
          });

          search_result_title_container.appendChild(search_result_title);
          search_result_description_container.appendChild(search_result_description);

          search_result_item.append(search_result_title_container, search_result_description_container);

          // if it's the last item, don't append a hr
          (i != (filtered_zotero_search_results.length - 1)) ? search_results.append(search_result_item, hr) : search_results.append(search_result_item);

          // ref for filtering: https://stackoverflow.com/questions/64457597/how-to-filter-html-collection-in-javascript
          filtered_search = Array.from(search_results.children).filter(search_result => search_result.classList.contains("search-result"));

          // clear authors
          zotero_authors = "";
          // clear year
          zotero_year = "";
        }
      }
      else if ((filtered_zotero_search_results.length == 0) && (search_bar.value != "")) {
        // no results found
        search_result_item = document.createElement("li");
        search_result_title_container = document.createElement("div");
        search_result_title = document.createTextNode("No results found");

        setAttributes(search_result_title_container, {
          "class": "title"
        });

        search_result_title_container.appendChild(search_result_title);
        search_result_item.append(search_result_title_container);
        search_results.append(search_result_item);
      }
    }
  }
  else {
    logseq.UI.showMsg("Logtero: Please go to the plugin settings and add the path to the Better BibTeX file", "error");
  }
}

// ref for assigning multiple attributes at once: https://stackoverflow.com/questions/12274748/setting-multiple-attributes-for-an-element-at-once-with-javascript (user: LJH in response to Ariel)
function setAttributes(element, attrs) {
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
}

function createZoteroPage(e) {
  let selected_zotero_item_path = e.path;
  let selected_zotero_item;
  
  if (selected_zotero_item_path) {
    selected_zotero_item_path.forEach(selected_path => {
      if (selected_path.className == "search-result") {
        selected_zotero_item_citekey = selected_path.id;
        getZoteroItems(0.0, ["citekey"], selected_zotero_item_citekey, "create");
      }
    });
  }
  else {
    selected_zotero_item = e;
    zoteroTemplates(selected_zotero_item);
  }
}

function zoteroTemplates(item) {
  const zotero_item = item;
  const page_title_template = logseq.settings.PageTitleTemplate;
  let page_title = page_title_template;
  let page_title_variables = page_title_template.match(/({{[\s\S]*?}})/gm);
  let selected_zotero_item_title;
  const zotero_page_properties_template = logseq.settings.PagePropertiesTemplate;
  let page_properties_variables = zotero_page_properties_template.match(/({{[\s\S]*?}})/gm);
  let page_properties = {};
  const custom_page_properties = logseq.settings.CustomPageProperties;
  let custom_page_properties_variables;
 
  function getPageTitle() {
    page_title_variables.forEach(page_title_variable => {
      if (page_title_variable == "{{authors}}") {
        formatZoteroAuthors(zotero_item.creators, "condense");
        page_title = page_title.replace("{{authors}}", zotero_authors);

        // clear authors
        zotero_authors = "";
      }
      else if (page_title_variable == "{{citekey}}") {
        (selected_zotero_item_citekey) ? page_title = page_title.replace(page_title_variable, selected_zotero_item_citekey) : page_title = page_title.replace(page_title_variable, "N/A");
      }
      else if (page_title_variable == "{{title}}") {
        selected_zotero_item_title = zotero_item.title;

        (selected_zotero_item_title) ? page_title = page_title.replace(page_title_variable, selected_zotero_item_title) : page_title = page_title.replace(page_title_variable, "N/A");
      }
      else if (page_title_variable == "{{year}}") {
        formatZoteroDate(zotero_item.date);

        (zotero_year) ? page_title = page_title.replace(page_title_variable, zotero_year) : page_title = page_title.replace(page_title_variable, "N/A");

        // clear year
        zotero_year = "";
      }
    });
  }

  function setProperties(property_key, property_value) {
    if ((property_key == "abstractNote") || (property_value == "abstractNote")) {
      let zotero_abstract = zotero_item.abstractNote;
      (zotero_abstract) ? page_properties[property_key] = zotero_abstract : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "authors") || (property_value == "authors")) {
      formatZoteroAuthors(zotero_item.creators, "complete");

      (zotero_authors) ? page_properties[property_key] = zotero_authors : page_properties[property_key] = "N/A";

      // clear authors
      zotero_authors = "";
    }
    else if ((property_key == "collection") || (property_value == "collection")) {
      let zotero_collections = zotero_library_collections;
      let zotero_item_id = zotero_item.itemID;

      (Object.entries(zotero_collections)).forEach(zotero_collection => {
        zotero_collection.forEach(collection => {
          if (collection.items) {
            ((collection.items).includes(zotero_item_id)) ? page_properties[property_key] = collection.name : page_properties[property_key] = "N/A";
          }
        });
      });
    }
    else if ((property_key == "citekey") || (property_value == "citekey")) {
      let zotero_citekey = zotero_item.citekey;
      (zotero_citekey) ? page_properties[property_key] = zotero_citekey : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "doi") || (property_value == "doi")) {
      let zotero_DOI = zotero_item.DOI;
      (zotero_DOI) ? page_properties[property_key] = zotero_DOI : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "filePath") || (property_value == "filePath") || (property_key == "pdf") || (property_value == "pdf")) {
      let zotero_attachments = zotero_item.attachments;

      if (zotero_attachments.length > 0) {
        zotero_attachments.forEach(attachment => {
          let zotero_file_path = attachment.path;
          if ((attachment.title != "Snapshot") && (zotero_file_path) && (zotero_file_path.slice(-3) == "pdf")) {
            if ((property_key == "filePath")) {
              (zotero_file_path) ? page_properties["file-path"] = zotero_file_path : page_properties[property_key] = "N/A";
            }
            else {
              (zotero_file_path) ? page_properties[property_key] = `![${attachment.title}](${zotero_file_path})` : page_properties[property_key] = "N/A";
            }
          }
        });
      }
    }
    else if ((property_key == "issue") || (property_value == "issue")) {
      let zotero_issue = zotero_item.issue;
      (zotero_issue) ? page_properties[property_key] = zotero_issue : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "itemType") || (property_value == "itemType")) {
      let zotero_item_type = zotero_item.itemType;
      (zotero_item_type) ? page_properties["item-type"] = zotero_item_type : page_properties["item-type"] = "N/A";
    }
    else if ((property_key == "journal") || (property_value == "journal")) {
      let zotero_journal = zotero_item.publicationTitle;
      (zotero_journal) ? page_properties[property_key] = zotero_journal : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "keywords") || (property_value == "keywords")) {
      let zotero_tags  = zotero_item.tags;
      let keywords = "";

      if (zotero_tags.length > 0) {
        for (let i = 0; i < zotero_tags.length; i++) {
          if (i != (zotero_tags.length - 1)) {
            keywords += `${zotero_tags[i].tag}, `;
          }
          else {
            keywords += `${zotero_tags[i].tag}`;
          }
        }
        (keywords) ? page_properties[property_key] = keywords : page_properties[property_key] = "N/A";
      }
    }
    else if ((property_key == "localLibrary") || (property_value == "localLibrary")) {
      let open_in_zotero = zotero_item.select;
      (open_in_zotero) ? page_properties["local-library"] = `[Local library](${open_in_zotero})` : page_properties["local-library"] = "N/A";
    }
    else if ((property_key == "pages") || (property_value == "pages")) {
      let zotero_page_numbers = zotero_item.pages;
      let zotero_total_num_pages = zotero_item.numPages;

      if (zotero_page_numbers) {
        page_properties[property_key] = zotero_page_numbers;
      }
      else if (zotero_total_num_pages) {
        page_properties[property_key] = zotero_total_num_pages;
      }
      else {
        page_properties[property_key] = "N/A";
      }
    }
    else if ((property_key == "title") || (property_value == "title")) {
      let zotero_title = zotero_item.title;
      (zotero_title) ? page_properties[property_key] = zotero_title : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "url") || (property_value == "url")) {
      let zotero_URL = zotero_item.url;
      (zotero_URL) ? page_properties[property_key] = zotero_URL : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "volume") || (property_value == "volume")) {
      let zotero_volume = zotero_item.volume;
      (zotero_volume) ? page_properties[property_key] = zotero_volume : page_properties[property_key] = "N/A";
    }
    else if ((property_key == "webLibrary") || (property_value == "webLibrary")) {
      let zotero_URI = zotero_item.uri;
      (zotero_URI) ? page_properties["web-library"] = `[Web library](${zotero_URI})` : page_properties["web-library"] = "N/A";
    }
    else if ((property_key == "year") || (property_value == "year")) {
      formatZoteroDate(zotero_item.date);

      (zotero_year) ? page_properties[property_key] = zotero_year : page_properties[property_key] = "N/A";

      // clear year
      zotero_year = "";
    }
    // custom properties to be filled in
    else if (property_value.length == 0) {
      page_properties[property_key] = "";
    }
    // custom properties w/ a value
    else if (property_value.length != 0) {
      page_properties[property_key] = property_value;
    }
    else {
      page_properties[property_key] = "Property isn't supported";
    }
  }

  // ref to get text inside of {{}}: https://stackoverflow.com/questions/5520880/getting-content-between-curly-braces-in-javascript-with-regex (user: amir hosein ahmadi)
  function getPageProperties() {
    page_properties_variables.forEach(page_properties_variable => {
      page_properties_variable = page_properties_variable.replace(/{|}/g , "");

      setProperties(page_properties_variable, "");
    });
  }

  function getCustomPageProperties() {
    custom_page_properties_variables = custom_page_properties.split(";");
    custom_page_properties_variables.forEach(custom_properties => {
      let custom_properties_key = custom_properties.split("::")[0].trim();
      let custom_properties_value = custom_properties.split("::")[1].trim().replace(/{|}/g , "");
      
      setProperties(custom_properties_key, custom_properties_value);
    });
  }

  if (page_title_template != "") {
    getPageTitle();

    // zotero and custom page properties
    if ((zotero_page_properties_template != "") && (custom_page_properties != "")) {
      getPageProperties();
      getCustomPageProperties();
    }
    else if ((zotero_page_properties_template != "") && (custom_page_properties == "")) {
      getPageProperties();
    }
    else if ((zotero_page_properties_template == "") && (custom_page_properties != "")) {
      getCustomPageProperties();
    }

    // create the page
    if (input_type == "slash command") {
      logseq.Editor.createPage(page_title, page_properties, {
        redirect: false,
        createFirstBlock: false
      });
      logseq.Editor.insertAtEditingCursor(`[[${page_title}]]`);
      logseq.Editor.exitEditingMode();
    }
    else {
      logseq.Editor.createPage(page_title, page_properties, {
          redirect: true,
          createFirstBlock: false
      });
    }
  }
  else {
    logseq.UI.showMsg("Please set a page title template for new Zotero pages", "error");
  }
}

function formatZoteroAuthors(authors, type) {
  for (let i = 0; i < authors.length; i++) {
    if (authors.length == 1) {
      zotero_authors = (authors[0].lastName) ? `${authors[0].lastName}` : `${authors[0].name}`;
    }
    else if (authors.length == 2) {
      // first author
      if (i != (authors.length - 1)) {
        zotero_authors += (authors[0].lastName) ? `${authors[0].lastName} ` : `${authors[0].name} `;
      }
      // second author
      else {
        zotero_authors += (authors[1].lastName) ? `and ${authors[1].lastName}` : `and ${authors[1].name}`;
      }
    }
    else if (authors.length >= 3) {
      if (type == "condense") {
        // first author et al.
        zotero_authors = (authors[0].lastName) ? `${authors[0].lastName} et al.` : `${authors[0].name} et al.`
      }
      else if (type == "complete") {
        if (i != (authors.length - 1)) {
          // comma-separate the authors: author last name, first letter of first name
          if ((authors[i].firstName) && (authors[i].lastName)) {
            zotero_authors += `${authors[i].lastName}, ${authors[i].firstName.charAt(0)}., `;
          }
          // only has last name
          else if (!(authors[i].firstName) && (authors[i].lastName)) {
            zotero_authors += `${authors[i].lastName}, `;
          }
          // only has first name
          else if ((authors[i].firstName) && !(authors[i].lastName)) {
            zotero_authors += `${authors[i].firstName}, `;
          }
          // has neither first or last name
          else {
            zotero_authors += `${authors[i].name} `;
          }
        }
        // last author
        else {
          // comma-separate the authors: author last name, first letter of first name
          if ((authors[authors.length - 1].firstName) && (authors[authors.length - 1].lastName)) {
            zotero_authors += `${authors[authors.length - 1].lastName}, ${authors[authors.length - 1].firstName.charAt(0)}.`;
          }
          // only has last name
          else if (!(authors[authors.length - 1].firstName) && (authors[authors.length - 1].lastName)) {
            zotero_authors += `${authors[authors.length - 1].lastName}`;
          }
          // only has first name
          else if ((authors[authors.length - 1].firstName) && !(authors[authors.length - 1].lastName)) {
            zotero_authors += `${authors[i].firstName}`;
          }
          // has neither first or last name
          else {
            zotero_authors += `${authors[authors.length - 1].name}`;
          }
        }
      }
    }
    else {
      zotero_authors = "N/A";
    }
  }

  return zotero_authors;
}

function formatZoteroDate(date) {
  // ref for formatting year from various date formats: https://stackoverflow.com/questions/650022/how-do-i-split-a-string-with-multiple-separators-in-javascript
  if (date) {
    if (date.match((/[,-/ ]+/))) {
      let zotero_date_arr = date.split(/[,-/ ]+/);
      
      if (zotero_date_arr) {
        zotero_date_arr.forEach(date_item => {
          if (date_item.trim().length == 4) {
            zotero_year = date_item.trim();
          }
        });
      }
      else {
        zotero_year = "N/A";
      }
    }
    else {
      zotero_year = date;
    }
  }
  else {
    zotero_year = "N/A";
  }

  return zotero_year;
}

function clearSearchResults() {
  if (search_results.children.length > 0) {
    for (let i = 0; i < search_results.children.length; i++) {
      (search_results.children[i]).remove();
      clearSearchResults();
    }
  }
}

function exitSearch() {
  logseq.hideMainUI();
  search_bar.value = "";
  search_bar.blur();
  clearSearchResults();
}

const main = async () => {
  console.log("logseq-logtero-plugin loaded");

  logseq.App.getUserConfigs().then(configs => {
    (configs.preferredThemeMode == "dark") ? document.body.className = "dark-theme" : document.body.className = "light-theme";
  });

  logseq.App.onThemeModeChanged((updated_theme) => {
    (updated_theme.mode == "dark") ? document.body.className = "dark-theme" : document.body.className = "light-theme";
  });

  // clicking outside of the plugin UI hides it
  document.addEventListener("click", function (e) {
    if (!e.target.closest("div")) {
      exitSearch();
    }
  });

  // use the escape key to hide the plugin UI
    document.addEventListener("keydown", function (e) {
    if (e.key == "Escape") {
      exitSearch();
    }
  });

  logseq.setMainUIInlineStyle({
    position: "absolute",
    backgroundColor: "transparent",
    top: "2.5em",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.5em",
    width: "100vw",
    height: "100vh",
    overflow: "auto",
    zIndex: 100
  });

  logseq.provideModel({
    show_settings() {
      logseq.showSettingsUI();
    }
  });

  // toolbar icon
  logseq.App.registerUIItem("toolbar", {
    key: "logtero",
    template:
      `<a data-on-click="show_settings" class="button">
        <svg id="zotero-icon" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-letter-z" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="var(--ls-primary-text-color)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M7 4h10l-10 16h10" />
        </svg>
      </a>`
  });

  // show error messages on first load to draw attention to opening the plugin settings
  setDriftlessTimeout(() => {
    if (logseq.settings.PathToBBT == "") {
      if (logseq.settings.PageTitleTemplate == "") {
        if (logseq.settings.PagePropertiesTemplate == "") {
          logseq.UI.showMsg(`Logtero: Please go to the plugin settings and add the following:\n- path to the Better BibTeX file\n- page title and/or page properties templates for new Zotero pages`, "error");
        }
      }
      else if (logseq.settings.PageTitleTemplate != "") {
        logseq.UI.showMsg(`Logtero: Please go to the plugin settings and add the following:\n- path to the Better BibTeX file`, "error");
      }
    }
    else {
      if (logseq.settings.PageTitleTemplate == "") {
        logseq.UI.showMsg(`Logtero: Please go to the plugin settings and add the following:\n- page title template for new Zotero pages`, "error");
      }
    }
  }, 50);

  // slash command
  logseq.Editor.registerSlashCommand("Logtero: Add a Zotero item", async () => {
    input_type = "slash command";
    logseq.showMainUI();
    search_bar.focus();
  });

  // command palette
  logseq.App.registerCommandPalette({
    key: "logseq-logtero",
    label: "Logtero: Add a Zotero item",
    keybinding: {
      binding: logseq.settings.KeyboardShortcut,
      mode: "global",
    }
  }, async () => {
    input_type = "command palette";
    logseq.showMainUI();
    search_bar.focus();
  });
}

logseq.ready(main).catch(console.error);