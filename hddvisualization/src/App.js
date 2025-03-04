import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  Button,
  Card,
  Typography,
  Upload,
  Steps,
  message,
  Spin,
  Alert,
  Layout,
  Divider,
  Space,
  Input,
  Modal,
  Form,
} from "antd";
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Header, Content, Footer } = Layout;
const { Step } = Steps;

const HddGeneratorApp = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hddData, setHddData] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("hdd-visualization");
  const [form] = Form.useForm();

  const handleFileChange = (info) => {
    if (info.file.status === "done") {
      setFile(info.file.originFileObj);
      setFileName(info.file.name);
      setErrorMessage("");
      setIsReady(false);
      message.success(`${info.file.name} file uploaded successfully`);
    } else if (info.file.status === "error") {
      message.error(`${info.file.name} file upload failed.`);
    }
  };

  const processExcelFile = async () => {
    if (!file) {
      message.error("Please select an Excel file first");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Process header to find required columns
      if (jsonData.length < 2) {
        throw new Error("File does not contain enough data");
      }

      const headers = jsonData[0];

      // Map expected headers to actual headers
      const headerMap = {
        "Joint #": -1,
        Length: -1,
        Inclination: -1,
        "L/R": -1,
        "Raw Azi.": -1,
        Away: -1,
        "Elev.": -1,
      };

      // Find the index of each required header
      headers.forEach((header, index) => {
        const headerStr = String(header).trim();
        if (headerStr === "Joint #" || headerStr === "Joint")
          headerMap["Joint #"] = index;
        else if (headerStr === "Length") headerMap["Length"] = index;
        else if (headerStr === "Inclination") headerMap["Inclination"] = index;
        else if (headerStr === "L/R") headerMap["L/R"] = index;
        else if (
          headerStr === "Raw Azi." ||
          headerStr === "Raw Azimuth" ||
          headerStr === "Azimuth" ||
          headerStr === "RawAzi"
        )
          headerMap["Raw Azi."] = index;
        else if (headerStr === "Away") headerMap["Away"] = index;
        else if (
          headerStr === "Elev." ||
          headerStr === "Elevation" ||
          headerStr === "Elev"
        )
          headerMap["Elev."] = index;
      });

      // Check if all required headers were found
      const missingHeaders = Object.entries(headerMap)
        .filter(([_, value]) => value === -1)
        .map(([key, _]) => key);

      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required headers: ${missingHeaders.join(", ")}`
        );
      }

      // Parse data rows and convert to proper format
      const parsedHddData = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (
          !row ||
          row.length === 0 ||
          row.every((cell) => cell === null || cell === "")
        )
          continue;

        try {
          const jointObj = {
            Joint: Number(row[headerMap["Joint #"]]),
            Length: Number(row[headerMap["Length"]]) || 0,
            Inclination: Number(row[headerMap["Inclination"]]) || 0,
            LR: Number(row[headerMap["L/R"]]) || 0,
            RawAzi: Number(row[headerMap["Raw Azi."]]) || 0,
            Away: Number(row[headerMap["Away"]]) || 0,
            Elev: Number(row[headerMap["Elev."]]) || 0,
          };

          // Only add if the mandatory fields are valid numbers
          if (
            !isNaN(jointObj.Joint) &&
            !isNaN(jointObj.Away) &&
            !isNaN(jointObj.Elev)
          ) {
            parsedHddData.push(jointObj);
          }
        } catch (e) {
          console.warn("Error processing row:", row, e);
          // Continue with the next row
        }
      }

      if (parsedHddData.length === 0) {
        throw new Error("No valid data rows found in file");
      }

      // Store the parsed data
      setHddData(parsedHddData);
      setIsReady(true);
      setCurrentStep(1);
      message.success("Excel data processed successfully!");
    } catch (error) {
      console.error("Error processing Excel file:", error);
      setErrorMessage(error.message || "Error processing Excel file");
      setIsReady(false);
      message.error(error.message || "Error processing Excel file");
    } finally {
      setIsProcessing(false);
    }
  };

  const showNameModal = () => {
    // Extract a default filename from the Excel file name
    if (fileName) {
      const baseName = fileName.split(".")[0];
      setDownloadFileName(baseName);
      form.setFieldsValue({ fileName: baseName });
    }
    setIsNameModalVisible(true);
  };

  const handleNameModalOk = () => {
    form.validateFields().then((values) => {
      setDownloadFileName(values.fileName);
      setIsNameModalVisible(false);
      generateHtmlFile(values.fileName);
    });
  };

  const handleNameModalCancel = () => {
    setIsNameModalVisible(false);
  };

  const generateHtmlFile = (customFileName) => {
    // Find the maximum absolute LR value for the y-axis range
    const maxAbsLR = Math.max(...hddData.map((d) => Math.abs(d.LR)));
    const lrAxisRange = Math.ceil(maxAbsLR + 5); // Add 5 feet as requested

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HDD Bore Geometry Visualization</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.1/plotly.min.js"></script>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f8f9fa;
      }
      .container {
        max-width: 1600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
        color: #333;
      }
      .visualization {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      #plot3d {
        width: 100%;
        height: 600px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        cursor: pointer !important;
      }
      #plot2d {
        width: 100%;
        height: 400px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        cursor: pointer !important;
      }
      .joint-info {
        margin-top: 20px;
        padding: 15px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        border-radius: 5px;
      }
      .joint-info h3 {
        margin-top: 0;
        color: #333;
      }
      .joint-data {
        font-family: monospace;
        white-space: pre;
        overflow-x: auto;
        background-color: #f5f5f5;
        padding: 10px;
        border-radius: 3px;
      }
      .controls {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      button {
        padding: 8px 15px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      button:hover {
        background-color: #0056b3;
      }
      .legend {
        display: flex;
        gap: 20px;
        margin-top: 10px;
        flex-wrap: wrap;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .legend-color {
        width: 20px;
        height: 20px;
        border: 1px solid #333;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        color: #666;
        font-size: 0.8rem;
      }
      .joint-details {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }
      .detail-card {
        background-color: #f5f5f5;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      .detail-card h4 {
        margin-top: 0;
        margin-bottom: 10px;
        color: #007bff;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
      }
      .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }
      .detail-label {
        font-weight: bold;
        color: #555;
      }
      .detail-value {
        font-family: monospace;
      }
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: #4CAF50;
        color: white;
        border-radius: 4px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        display: none;
        z-index: 1000;
      }
      .error {
        background-color: #f44336;
      }
      /* Ensure cursor is pointer for all plotly elements */
      .plotly, .main-svg, .draglayer, .xy, .gridlayer, .zoomlayer {
        cursor: pointer !important;
      }
      /* Zoom controls */
      .zoom-controls {
        position: absolute;
        top: 120px;
        right: 20px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        z-index: 100;
      }
      .zoom-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }
      /* Arrow styles for zoom buttons */
      .zoom-in-arrow {
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 12px solid white;
      }
      .zoom-out-arrow {
        width: 16px;
        height: 4px;
        background-color: white;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Horizontal Directional Drilling - Bore Geometry Visualization</h1>
      </div>
      
      <div id="notification" class="notification"></div>

      <div class="controls">
        <button id="resetViewBtn">Reset View</button>
        <button id="frontViewBtn">Front View</button>
        <button id="topViewBtn">Top View</button>
        <button id="toggleJointsBtn">Toggle Joints</button>
      </div>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #1f77b4"></div>
          <span>Bore Path</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: red"></div>
          <span>Selected Joint</span>
        </div>
      </div>

      <div class="visualization">
        <div style="position: relative;">
          <div id="plot3d"></div>
          <div class="zoom-controls">
            <button class="zoom-btn" id="zoomInBtn"><div class="zoom-in-arrow"></div></button>
            <button class="zoom-btn" id="zoomOutBtn"><div class="zoom-out-arrow"></div></button>
          </div>
        </div>
        <div id="plot2d"></div>
      </div>

      <div class="joint-info">
        <h3>Joint Information</h3>
        <p>Click on a joint in the profile view or 3D view to view its details.</p>
        <div id="joint-data" class="joint-data">No joint selected</div>
        
        <div class="joint-details" id="joint-details">
          <!-- Joint details will be inserted here by JavaScript -->
        </div>
      </div>

      <div class="footer">
        <p>HDD Bore Geometry Visualization</p>
      </div>
    </div>

    <script>
      // HDD Bore Data
      let hddData = ${JSON.stringify(hddData, null, 2)};

      // Extract data for plotting
      let away = hddData.map((d) => d.Away);
      let elev = hddData.map((d) => d.Elev);
      let lr = hddData.map((d) => d.LR);

      // Create adjusted LR values based on azimuth (approximately)
      let lrAdjusted = hddData.map((d) => {
        return d.LR * Math.cos((233.5 * Math.PI) / 180);
      });

      // Function to show notification
      function showNotification(message, isError = false) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.display = 'block';
        
        if (isError) {
          notification.classList.add('error');
        } else {
          notification.classList.remove('error');
        }
        
        setTimeout(() => {
          notification.style.display = 'none';
        }, 5000);
      }

      // Create 3D plots using Plotly
      function createPlots() {
        // 3D Plot
        const borePath = {
          type: "scatter3d",
          mode: "lines+markers",
          name: "Bore Path",
          x: away,
          y: lrAdjusted,
          z: elev,
          line: {
            color: "#1f77b4",
            width: 6,
          },
          marker: {
            size: 5,
            color: "#1f77b4",
            symbol: "circle",
          },
          hoverinfo: "text",
          hovertext: hddData.map(
            (d) =>
              \`Joint: \${d.Joint}<br>\` +
              \`Away: \${d.Away.toFixed(2)} ft<br>\` +
              \`Elevation: \${d.Elev.toFixed(2)} ft<br>\` +
              \`Inclination: \${d.Inclination.toFixed(2)}°<br>\` +
              \`L/R: \${d.LR.toFixed(2)}\`
          ),
          customdata: hddData.map((d, i) => i) // Adding customdata to enable click events on 3D traces
        };

        // Individual joints as points
        const joints = {
          type: "scatter3d",
          mode: "markers",
          name: "Joints",
          x: away,
          y: lrAdjusted,
          z: elev,
          marker: {
            size: 8,
            color: "#1f77b4",
            symbol: "circle",
            line: {
              color: "black",
              width: 1,
            },
          },
          hoverinfo: "text",
          hovertext: hddData.map(
            (d) =>
              \`Joint: \${d.Joint}<br>\` +
              \`Away: \${d.Away.toFixed(2)} ft<br>\` +
              \`Elevation: \${d.Elev.toFixed(2)} ft<br>\` +
              \`Inclination: \${d.Inclination.toFixed(2)}°<br>\` +
              \`L/R: \${d.LR.toFixed(2)}\`
          )
          // Removed customdata to make joints not clickable
        };

        // 3D Plot layout with zoomed out view and axes at bottom
        const layout3d = {
          title: {
            text: "3D Bore Geometry",
            font: {
              family: "Arial, sans-serif",
              size: 24,
            },
          },
          autosize: true,
          scene: {
            aspectratio: {
              x: 4,
              y: 1,
              z: 1,
            },
            xaxis: {
              title: "Away Distance (ft)",
              gridcolor: "#dddddd",
              zerolinecolor: "#999999",
              showbackground: true,
              backgroundcolor: "#f8f8f8",
              showspikes: false,
              // Position axis at bottom
              anchor: "y",
            },
            yaxis: {
              title: "Left/Right Offset (ft)",
              gridcolor: "#dddddd",
              zerolinecolor: "#999999",
              showbackground: true,
              backgroundcolor: "#f8f8f8",
              range: [-${lrAxisRange}, ${lrAxisRange}], // Set the y-axis range with 5ft padding
              showspikes: false,
              // Position axis at bottom
              anchor: "x"
            },
            zaxis: {
              title: "Elevation (ft)",
              gridcolor: "#dddddd",
              zerolinecolor: "#999999",
              showbackground: true,
              backgroundcolor: "#f8f8f8",
              showspikes: false,
            },
            camera: {
              eye: { x: 3, y: -3, z: 1.25 }, // Zoomed out view
              center: { x: 0, y: 0, z: 0 },
            },
          },
          margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 4,
          },
          showlegend: true,
          legend: {
            x: 0,
            y: 1,
            orientation: "h",
          },
        };

        // 2D Profile Plot (elevation vs. away)
        const profile = {
          type: "scatter",
          mode: "lines+markers",
          name: "Bore Path Profile",
          x: away,
          y: elev,
          line: {
            color: "#1f77b4",
            width: 3,
          },
          marker: {
            size: 6,
            color: "#1f77b4",
          },
          hoverinfo: "text",
          hovertext: hddData.map(
            (d) =>
              \`Joint: \${d.Joint}<br>\` +
              \`Away: \${d.Away.toFixed(2)} ft<br>\` +
              \`Elevation: \${d.Elev.toFixed(2)} ft<br>\` +
              \`Inclination: \${d.Inclination.toFixed(2)}°\`
          ),
          customdata: hddData.map((d, i) => i),
        };

        // 2D Plot layout with dual y-axes
        const layout2d = {
          title: {
            text: "Bore Profile (Elevation vs. Distance)",
            font: {
              family: "Arial, sans-serif",
              size: 20,
            },
          },
          xaxis: {
            title: "Away Distance (ft)",
            gridcolor: "#dddddd",
            zerolinecolor: "#999999",
          },
          yaxis: {
            title: "Elevation (ft)",
            gridcolor: "#dddddd",
            zerolinecolor: "#999999",
            side: "left",
          },
          // Add a second y-axis on the right
          yaxis2: {
            title: "Elevation (ft)",
            gridcolor: "#dddddd",
            zerolinecolor: "#999999",
            side: "right",
            overlaying: "y",
            showgrid: false,
          },
          margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 4,
          },
          showlegend: true,
          legend: {
            x: 0,
            y: 1,
            orientation: "h",
          },
          // Remove lasso select from the modebar
          dragmode: 'zoom',
        };

        // Create 3D plot with modeBarButtonsToRemove option to remove reset camera and other buttons
        Plotly.newPlot(
          "plot3d",
          [borePath, joints],
          layout3d,
          { 
            responsive: true,
            displaylogo: false, // Remove Plotly logo
            modeBarButtonsToRemove: [
              'resetCameraLastSave3d', 
              'resetCameraDefault3d',
              'hoverClosest3d',
              'orbitRotation',
              'resetViewMapbox'
            ],
            displayModeBar: true
          }
        );

        // Create 2D plot with specific config to remove lasso select
        Plotly.newPlot(
          "plot2d",
          [profile],
          layout2d,
          { 
            responsive: true,
            displaylogo: false, // Remove Plotly logo
            modeBarButtonsToRemove: [
              'resetScale2d',
              'hoverClosestCartesian',
              'hoverCompareCartesian',
              'toggleSpikelines',
              'lasso2d' // Remove lasso select
            ],
            displayModeBar: true
          }
        );

        // Set up event listeners for interactivity
        setupEventListeners();
      }

      function setupEventListeners() {
        // Joint selection in 2D plot (profile view)
        document.getElementById("plot2d").on("plotly_click", function (data) {
          handlePointSelection(data);
        });
        
        // Joint selection in 3D plot - only for the bore path, not the joints
        document.getElementById("plot3d").on("plotly_click", function (data) {
          // Make sure we're only handling clicks on the borePath (index 0)
          // and not on the joints (index 1)
          if (data.points[0].curveNumber === 0) {
            handlePointSelection(data);
          }
        });

        // Reset view button
        document
          .getElementById("resetViewBtn")
          .addEventListener("click", function () {
            Plotly.relayout("plot3d", {
              "scene.camera.eye": { x: 3, y: -3, z: 1.25 }, // Zoomed out view
              "scene.camera.center": { x: 0, y: 0, z: 0 },
            });

            // Reset joint selection
            clearSelectedJoint();
          });
          
        // Front view button
        document
          .getElementById("frontViewBtn")
          .addEventListener("click", function () {
            Plotly.relayout("plot3d", {
              "scene.camera.eye": { x: 0, y: -2.5, z: 0.1 },
              "scene.camera.center": { x: 0, y: 0, z: 0 },
            });
          });
          
        // Top view button (fixed to be directly overhead)
        document
          .getElementById("topViewBtn")
          .addEventListener("click", function () {
            Plotly.relayout("plot3d", {
              "scene.camera.eye": { x: 0.1, y: 0.1, z: 2.5 },
              "scene.camera.center": { x: 0, y: 0, z: 0 },
              "scene.camera.up": { x: 0, y: 1, z: 0 }
            });
          });

        // Toggle joints visibility
        document
          .getElementById("toggleJointsBtn")
          .addEventListener("click", function () {
            const plot3d = document.getElementById("plot3d");
            const visibility =
              plot3d.data[1].visible === "legendonly" ? true : "legendonly";

            Plotly.restyle("plot3d", { visible: visibility }, [1]);
          });
          
        // Zoom in button
        document
          .getElementById("zoomInBtn")
          .addEventListener("click", function () {
            const plot3d = document.getElementById("plot3d");
            const currentEye = plot3d._fullLayout.scene.camera.eye;
            const newEye = {
              x: currentEye.x * 0.8,
              y: currentEye.y * 0.8,
              z: currentEye.z * 0.8
            };
            Plotly.relayout("plot3d", {"scene.camera.eye": newEye});
          });
          
        // Zoom out button
        document
          .getElementById("zoomOutBtn")
          .addEventListener("click", function () {
            const plot3d = document.getElementById("plot3d");
            const currentEye = plot3d._fullLayout.scene.camera.eye;
            const newEye = {
              x: currentEye.x * 1.2,
              y: currentEye.y * 1.2,
              z: currentEye.z * 1.2
            };
            Plotly.relayout("plot3d", {"scene.camera.eye": newEye});
          });
      }

      function handlePointSelection(data) {
        if (!data || !data.points || data.points.length === 0) return;

        const point = data.points[0];
        if (!point.hasOwnProperty("customdata")) return;

        const jointIndex = point.customdata;

        // Update the joint info display
        updateJointInfo(jointIndex);

        // Highlight the selected joint in 3D and 2D
        highlightSelectedJoint(jointIndex);
        
        // Ensure the joint info is visible by scrolling to it
        document.querySelector('.joint-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function updateJointInfo(jointIndex) {
        const joint = hddData[jointIndex];
        if (!joint) {
          console.error("Invalid joint index:", jointIndex);
          return;
        }

        try {
          // Format joint information with all available data
          const jointInfo =
            \`Joint #: \${joint.Joint}\\n\` +
            \`Length: \${joint.Length.toFixed(2)} ft\\n\` +
            \`Inclination: \${joint.Inclination.toFixed(2)}°\\n\` +
            \`L/R: \${joint.LR.toFixed(2)} ft\\n\` +
            \`Raw Azimuth: \${joint.RawAzi.toFixed(2)}°\\n\` +
            \`Away: \${joint.Away.toFixed(2)} ft\\n\` +
            \`Elevation: \${joint.Elev.toFixed(2)} ft\`;

          // Direct DOM manipulation for better reliability
          const jointDataElement = document.getElementById("joint-data");
          jointDataElement.textContent = jointInfo;
          jointDataElement.style.fontWeight = "bold";
          jointDataElement.style.color = "#333";
          
          // Create detailed joint information cards
          const jointDetailsContainer = document.getElementById("joint-details");
          jointDetailsContainer.innerHTML = ""; // Clear previous content
          
          // Position Card with complete information
          const positionCard = document.createElement("div");
          positionCard.className = "detail-card";
          positionCard.innerHTML = \`
            <h4>Position</h4>
            <div class="detail-item">
              <span class="detail-label">Away Distance:</span>
              <span class="detail-value">\${joint.Away.toFixed(2)} ft</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Elevation:</span>
              <span class="detail-value">\${joint.Elev.toFixed(2)} ft</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Left/Right Offset:</span>
              <span class="detail-value">\${joint.LR.toFixed(2)} ft</span>
            </div>
          \`;
          
          // Orientation Card with complete information
          const orientationCard = document.createElement("div");
          orientationCard.className = "detail-card";
          orientationCard.innerHTML = \`
            <h4>Orientation</h4>
            <div class="detail-item">
              <span class="detail-label">Inclination:</span>
              <span class="detail-value">\${joint.Inclination.toFixed(2)}°</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Azimuth:</span>
              <span class="detail-value">\${joint.RawAzi.toFixed(2)}°</span>
            </div>
          \`;
          
          // Joint Details Card with complete information
          const jointDetailsCard = document.createElement("div");
          jointDetailsCard.className = "detail-card";
          jointDetailsCard.innerHTML = \`
            <h4>Joint Details</h4>
            <div class="detail-item">
              <span class="detail-label">Joint Number:</span>
              <span class="detail-value">\${joint.Joint}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Length:</span>
              <span class="detail-value">\${joint.Length.toFixed(2)} ft</span>
            </div>
          \`;
          
          // Add the cards to the container
          jointDetailsContainer.appendChild(positionCard);
          jointDetailsContainer.appendChild(orientationCard);
          jointDetailsContainer.appendChild(jointDetailsCard);
          
          // Debug check
          console.log("Joint info updated for joint:", joint.Joint);
        } catch (error) {
          console.error("Error updating joint info:", error);
        }
      }

      function highlightSelectedJoint(jointIndex) {
        try {
          // Get current data from plots
          const plot3d = document.getElementById("plot3d");
          const plot2d = document.getElementById("plot2d");

          // Clear any previous selection first
          clearSelectedJoint();

          // Create highlighted point for 3D plot
          const highlightedPoint3D = {
            type: "scatter3d",
            mode: "markers",
            name: "Selected Joint",
            x: [hddData[jointIndex].Away],
            y: [lrAdjusted[jointIndex]],
            z: [hddData[jointIndex].Elev],
            marker: {
              size: 12,
              color: "red",
              symbol: "circle",
              line: {
                color: "white",
                width: 1,
              },
            },
            hoverinfo: "text",
            hovertext: \`Joint #\${hddData[jointIndex].Joint}\`,
            showlegend: false,
          };

          // Create highlighted point for 2D plot
          const highlightedPoint2D = {
            type: "scatter",
            mode: "markers",
            name: "Selected Joint",
            x: [hddData[jointIndex].Away],
            y: [hddData[jointIndex].Elev],
            marker: {
              size: 12,
              color: "red",
              symbol: "circle",
              line: {
                color: "white",
                width: 1,
              },
            },
            hoverinfo: "text",
            hovertext: \`Joint #\${hddData[jointIndex].Joint}\`,
            showlegend: false,
          };

          // Add the highlighted points to the plots
          Plotly.addTraces("plot3d", highlightedPoint3D);
          Plotly.addTraces("plot2d", highlightedPoint2D);
          
          console.log("Joint highlighted:", jointIndex);
        } catch (error) {
          console.error("Error highlighting joint:", error);
        }
      }

      function clearSelectedJoint() {
        try {
          const plot3d = document.getElementById("plot3d");
          const plot2d = document.getElementById("plot2d");

          // Check if there's a selected joint (it would be the last trace)
          if (plot3d && plot3d.data.length > 2) {
            Plotly.deleteTraces("plot3d", plot3d.data.length - 1);
          }

          if (plot2d && plot2d.data.length > 1) {
            Plotly.deleteTraces("plot2d", plot2d.data.length - 1);
          }

          // Reset joint info
          document.getElementById("joint-data").textContent = "No joint selected";
          document.getElementById("joint-data").style.fontWeight = "normal";
          document.getElementById("joint-data").style.color = "";
          
          // Clear the detailed joint information
          document.getElementById("joint-details").innerHTML = "";
          
          console.log("Cleared selected joint");
        } catch (error) {
          console.error("Error clearing selected joint:", error);
        }
      }

      // Initialize the plots when the page loads
      window.addEventListener("load", function() {
        createPlots();
        
        // Apply cursor style after plots are loaded
        setTimeout(function() {
          document.querySelectorAll('.plotly, .main-svg, .draglayer, .xy').forEach(el => {
            el.style.cursor = 'pointer';
          });
        }, 1000);
      });
      
      // Ensure joint information is displayed properly by adding event debugging
      document.getElementById("plot2d").addEventListener("click", function(e) {
        console.log("Raw click on plot2d at:", e.clientX, e.clientY);
      });
    </script>
  </body>
</html>`;

    // Create blob object with file content
    const blob = new Blob([htmlContent], { type: "text/html" });

    // Create URL for the blob
    const url = URL.createObjectURL(blob);

    // Create anchor element for download
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customFileName}.html`;

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success("HTML visualization file generated and downloaded!");
    setCurrentStep(2);
  };

  const handleStartDownload = () => {
    showNameModal();
  };

  const customUploadProps = {
    name: "file",
    accept: ".xlsx, .xls",
    showUploadList: false,
    beforeUpload: (file) => {
      setFile(file);
      setFileName(file.name);
      setErrorMessage("");
      setIsReady(false);
      return false;
    },
    customRequest: ({ file, onSuccess }) => {
      setTimeout(() => {
        onSuccess("ok", null);
      }, 0);
    },
  };

  const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

  return (
    <Layout className="min-h-screen">
      <Header className="bg-blue-700">
        <div className="mx-auto max-w-6xl px-4">
          <Title level={3} className="text-white my-0 py-4">
            HDD Bore Geometry Visualization Generator
          </Title>
        </div>
      </Header>

      <Content className="bg-gray-100 py-8">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="mb-6 shadow-md">
            <Steps current={currentStep} className="mb-8">
              <Step title="Upload" description="Excel file" />
              <Step title="Process" description="Data analysis" />
              <Step title="Download" description="HTML visualization" />
            </Steps>

            {currentStep === 0 && (
              <div>
                <Title level={4}>Upload Excel File</Title>
                <Paragraph>
                  Select an Excel file with HDD bore data. The file must contain
                  the following columns:
                </Paragraph>
                <ul className="list-disc pl-8 mb-4 text-gray-700">
                  <li>Joint # (or Joint)</li>
                  <li>Length</li>
                  <li>Inclination</li>
                  <li>L/R</li>
                  <li>Raw Azi. (or Raw Azimuth, Azimuth, RawAzi)</li>
                  <li>Away</li>
                  <li>Elev. (or Elevation, Elev)</li>
                </ul>

                <Dragger {...customUploadProps} className="mb-6">
                  <p className="ant-upload-drag-icon">
                    <FileExcelOutlined
                      style={{ fontSize: "32px", color: "#1890ff" }}
                    />
                  </p>
                  <p className="ant-upload-text">
                    Click or drag Excel file to this area to upload
                  </p>
                  <p className="ant-upload-hint">
                    Support for single Excel file upload (.xlsx, .xls)
                  </p>
                </Dragger>

                {fileName && (
                  <Alert
                    message={`Selected file: ${fileName}`}
                    type="info"
                    showIcon
                    className="mb-4"
                  />
                )}

                <Button
                  type="primary"
                  onClick={processExcelFile}
                  disabled={!file || isProcessing}
                  icon={isProcessing ? <Spin indicator={antIcon} /> : null}
                  size="large"
                  block
                  style={{ marginTop: "10px" }}
                >
                  {isProcessing ? "Processing..." : "Process Excel File"}
                </Button>

                {errorMessage && (
                  <Alert
                    message="Error"
                    description={errorMessage}
                    type="error"
                    showIcon
                    className="mt-4"
                  />
                )}
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <Alert
                  message="Data Processed Successfully"
                  description="Your Excel data has been processed and is ready to be used for visualization."
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  className="mb-6"
                />

                <div className="mb-4">
                  <Title level={4}>Data Summary</Title>
                  <Space direction="vertical" className="w-full">
                    <Text>
                      Total Joints: <Text strong>{hddData.length}</Text>
                    </Text>
                    <Text>
                      Distance Range:{" "}
                      <Text strong>
                        {hddData[0]?.Away.toFixed(2)} ft to{" "}
                        {hddData[hddData.length - 1]?.Away.toFixed(2)} ft
                      </Text>
                    </Text>
                    <Text>
                      Elevation Range:{" "}
                      <Text strong>
                        {Math.min(...hddData.map((d) => d.Elev)).toFixed(2)} ft
                        to {Math.max(...hddData.map((d) => d.Elev)).toFixed(2)}{" "}
                        ft
                      </Text>
                    </Text>
                    <Text>
                      Max L/R Offset:{" "}
                      <Text strong>
                        {Math.max(
                          ...hddData.map((d) => Math.abs(d.LR))
                        ).toFixed(2)}{" "}
                        ft
                      </Text>
                    </Text>
                  </Space>
                </div>

                <Divider />

                <Button
                  type="primary"
                  onClick={handleStartDownload}
                  icon={<DownloadOutlined />}
                  size="large"
                  block
                >
                  Generate & Download HTML Visualization
                </Button>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <Alert
                  message="HTML File Generated"
                  description="Your HTML visualization file has been generated and downloaded to your computer."
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  className="mb-6"
                />

                <Paragraph>
                  The HTML file contains a standalone visualization of your HDD
                  bore data. You can open it in any modern web browser to
                  explore the visualization.
                </Paragraph>

                <Title level={5}>HTML Visualization Features:</Title>
                <ul className="list-disc pl-8 mb-4 text-gray-700">
                  <li>Interactive 3D bore path visualization</li>
                  <li>2D profile view with dual elevation axes</li>
                  <li>Front and top view controls</li>
                  <li>
                    Detailed joint information when clicking on the profile view
                  </li>
                  <li>Works offline - no internet connection required</li>
                </ul>

                <Divider />

                <Space className="w-full">
                  <Button
                    onClick={() => {
                      setFile(null);
                      setFileName("");
                      setIsReady(false);
                      setErrorMessage("");
                      setCurrentStep(0);
                    }}
                  >
                    Start Over
                  </Button>

                  <Button
                    type="primary"
                    onClick={handleStartDownload}
                    icon={<DownloadOutlined />}
                  >
                    Download Again
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        </div>
      </Content>

      <Footer className="text-center bg-gray-800 text-gray-300">
        <Text className="text-gray-300">
          HDD Bore Geometry Visualization Generator
        </Text>
        <br />
        <Text className="text-gray-400">
          Upload Excel → Process Data → Download HTML
        </Text>
      </Footer>

      <Modal
        title="Name Your Visualization File"
        visible={isNameModalVisible}
        onOk={handleNameModalOk}
        onCancel={handleNameModalCancel}
        okText="Download"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ fileName: downloadFileName }}
        >
          <Form.Item
            name="fileName"
            label="File Name"
            rules={[
              { required: true, message: "Please enter a file name" },
              {
                pattern: /^[^<>:"/\\|?*]+$/,
                message: "File name contains invalid characters",
              },
            ]}
          >
            <Input
              addonAfter=".html"
              placeholder="Enter file name"
              maxLength={100}
            />
          </Form.Item>
          <p className="text-gray-500 text-sm">
            Enter a name for your visualization file without extension
          </p>
        </Form>
      </Modal>
    </Layout>
  );
};

export default HddGeneratorApp;
