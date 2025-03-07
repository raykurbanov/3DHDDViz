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
  Tabs,
  Table,
  Switch,
  Tooltip,
  Collapse,
} from "antd";
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Header, Content, Footer } = Layout;
const { Step } = Steps;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const HddGeneratorApp = () => {
  // Core HDD data states
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

  // New surface data states
  const [surfaceFile, setSurfaceFile] = useState(null);
  const [surfaceFileName, setSurfaceFileName] = useState("");
  const [surfaceData, setSurfaceData] = useState([]);
  const [isSurfaceProcessing, setIsSurfaceProcessing] = useState(false);
  const [isSurfaceReady, setIsSurfaceReady] = useState(false);
  const [surfaceErrorMessage, setSurfaceErrorMessage] = useState("");
  const [surfaceSuccessMessage, setSurfaceSuccessMessage] = useState("");
  const [showSurfaceData, setShowSurfaceData] = useState(true);
  const [entryPoint, setEntryPoint] = useState(null);
  const [exitPoint, setExitPoint] = useState(null);

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

  const handleSurfaceFileChange = (info) => {
    if (info.file.status === "done") {
      setSurfaceFile(info.file.originFileObj);
      setSurfaceFileName(info.file.name);
      setSurfaceErrorMessage("");
      setIsSurfaceReady(false);
      message.success(`${info.file.name} surface file uploaded successfully`);
    } else if (info.file.status === "error") {
      message.error(`${info.file.name} surface file upload failed.`);
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
          console.log(jointObj);

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

      // Identify entry and exit points
      const sortedData = [...parsedHddData].sort((a, b) => a.Away - b.Away);
      setEntryPoint(sortedData[0]);
      setExitPoint(sortedData[sortedData.length - 1]);

      // Store the parsed data
      setHddData(parsedHddData);

      // Also process surface data if available
      if (surfaceFile && !isSurfaceReady) {
        await processSurfaceExcelFile();
      }

      setIsReady(true);
      setCurrentStep(1);
      message.success("Data processed successfully!");
    } catch (error) {
      console.error("Error processing Excel file:", error);
      setErrorMessage(error.message || "Error processing Excel file");
      setIsReady(false);
      message.error(error.message || "Error processing Excel file");
    } finally {
      setIsProcessing(false);
    }
  };

  const processSurfaceExcelFile = async () => {
    if (!surfaceFile) {
      message.error("Please select a surface Excel file first");
      return;
    }

    setIsSurfaceProcessing(true);
    setSurfaceErrorMessage("");
    setSurfaceSuccessMessage("");

    try {
      const data = await surfaceFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Process header to find required columns
      if (jsonData.length < 2) {
        throw new Error("Surface file does not contain enough data");
      }

      const headers = jsonData[0];

      // Map expected headers for surface data (only Station and Elevation required)
      const headerMap = {
        Station: -1,
        Elevation: -1,
      };

      // Find the index of each required header
      headers.forEach((header, index) => {
        const headerStr = String(header).trim();
        if (
          headerStr === "Station" ||
          headerStr === "STATION" ||
          headerStr === "STA"
        )
          headerMap["Station"] = index;
        else if (
          headerStr === "Elevation" ||
          headerStr === "ELEVATION" ||
          headerStr === "ELEV"
        )
          headerMap["Elevation"] = index;
      });

      // Check if all required headers were found
      const missingHeaders = Object.entries(headerMap)
        .filter(([_, value]) => value === -1)
        .map(([key, _]) => key);

      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required surface headers: ${missingHeaders.join(", ")}`
        );
      }

      // Parse data rows and convert to proper format
      const parsedSurfaceData = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (
          !row ||
          row.length === 0 ||
          row.every((cell) => cell === null || cell === "")
        )
          continue;

        try {
          const surfacePoint = {
            Station: Number(row[headerMap["Station"]]),
            Elevation: Number(row[headerMap["Elevation"]]),
            Offset: 0, // Default to 0 as we're only using Station and Elevation
          };

          // Only add if all fields are valid numbers
          if (!isNaN(surfacePoint.Station) && !isNaN(surfacePoint.Elevation)) {
            parsedSurfaceData.push(surfacePoint);
          }
        } catch (e) {
          console.warn("Error processing surface row:", row, e);
          // Continue with the next row
        }
      }

      if (parsedSurfaceData.length === 0) {
        throw new Error("No valid data rows found in surface file");
      }

      // Store the parsed surface data
      setSurfaceData(parsedSurfaceData);
      setIsSurfaceReady(true);
      setShowSurfaceData(true); // Always show the surface

      // Display success messages
      message.success({
        content: "Surface data processed successfully!",
        duration: 4,
        icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      });

      // Set success message for Alert component
      const successMessage = `Successfully processed ${
        parsedSurfaceData.length
      } surface data points. 
        Station range: ${Math.min(
          ...parsedSurfaceData.map((d) => d.Station)
        ).toFixed(2)} to 
        ${Math.max(...parsedSurfaceData.map((d) => d.Station)).toFixed(2)} ft.`;
      setSurfaceSuccessMessage(successMessage);
    } catch (error) {
      console.error("Error processing surface Excel file:", error);
      setSurfaceErrorMessage(
        error.message || "Error processing surface Excel file"
      );
      setIsSurfaceReady(false);
      message.error(error.message || "Error processing surface Excel file");
    } finally {
      setIsSurfaceProcessing(false);
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

    // Log the HDD data to ensure elevations are being properly set
    console.log("HDD Data for visualization:", hddData);

    // Prepare the joints table data for the HTML visualization
    const jointsTableData = hddData
      .map((joint) => {
        return `{
        "Joint": ${joint.Joint},
        "Length": ${joint.Length.toFixed(2)},
        "Inclination": ${joint.Inclination.toFixed(2)},
        "LR": ${joint.LR.toFixed(2)},
        "RawAzi": ${joint.RawAzi.toFixed(2)},
        "Away": ${joint.Away.toFixed(2)},
        "Elev": ${joint.Elev.toFixed(2)}
      }`;
      })
      .join(",");

    // Prepare surface data if available
    const surfaceDataJSON =
      isSurfaceReady && surfaceData.length > 0
        ? JSON.stringify(surfaceData)
        : "[]";

    // Determine entry and exit points for center line
    const entryPointJSON = entryPoint ? JSON.stringify(entryPoint) : "null";
    const exitPointJSON = exitPoint ? JSON.stringify(exitPoint) : "null";

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
        cursor: pointer;
      }
      #plot2d {
        width: 100%;
        height: 400px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        cursor: pointer;
      }
      .controls {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .surface-toggle {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 10px;
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
      /* New styles for joints table */
      .joints-table-container {
        margin-top: 30px;
        overflow-x: auto;
      }
      .joints-table {
        width: 100%;
        border-collapse: collapse;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      .joints-table th,
      .joints-table td {
        padding: 8px 12px;
        text-align: left;
        border: 1px solid #ddd;
      }
      .joints-table th {
        background-color: #f2f2f2;
        position: sticky;
        top: 0;
        font-weight: bold;
      }
      .joints-table tr:nth-child(even) {
        background-color: #f8f8f8;
      }
      .joints-table tr:hover {
        background-color: #e9f5ff;
      }
      /* For highlighting selected joint in the table */
      .joints-table tr.selected {
        background-color: #d4edff;
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
      /* Switch toggle for surface visibility */
      .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 24px;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      input:checked + .slider {
        background-color: #2196F3;
      }
      input:checked + .slider:before {
        transform: translateX(26px);
      }
      /* Make table scrollable after 15 rows */
      .table-scrollable {
        max-height: 600px; /* Height for approximately 15 rows */
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Horizontal Directional Drilling - Bore Geometry Visualization</h1>
        <h2>${customFileName}</h2>
      </div>
      
      <div id="notification" class="notification"></div>

      <div class="controls">
        <button id="resetViewBtn">Reset View</button>
        <button id="frontViewBtn">Front View</button>
        <button id="topViewBtn">Top View</button>
        <button id="toggleCenterlineBtn">Toggle Centerline</button>
        
    <!-- Surface toggle removed as surface is always shown -->
      </div>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #1f77b4"></div>
          <span>Bore Path</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #33cc33"></div>
          <span>Surface</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #ff9900"></div>
          <span>Centerline</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: rgba(255, 153, 0, 0.3)"></div>
          <span>Centerline Corridor (10ft)</span>
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

      <!-- Joints Data Table -->
      <div class="joints-table-container">
        <h3>Bore Path Joint Data</h3>
        <div class="table-scrollable">
          <table class="joints-table" id="jointsTable">
            <thead>
              <tr>
                <th>Joint #</th>
                <th>Away (ft)</th>
                <th>Elevation (ft)</th>
                <th>Length (ft)</th>
                <th>Inclination (°)</th>
                <th>L/R (ft)</th>
                <th>Azimuth (°)</th>
                <th>Depth to Surface (ft)</th>
              </tr>
            </thead>
            <tbody id="jointsTableBody">
              <!-- Table rows will be populated dynamically with JavaScript -->
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        <p>HDD Bore Geometry Visualization</p>
      </div>
    </div>

    <script>
      // HDD Bore Data
      let hddData = [${jointsTableData}];

      // Surface data
      let surfaceData = ${surfaceDataJSON};
      
      // Entry and exit points for centerline
      const entryPoint = ${entryPointJSON};
      const exitPoint = ${exitPointJSON};

      // Extract data for plotting
      let away = hddData.map((d) => d.Away);
      let elev = hddData.map((d) => d.Elev);
      let lr = hddData.map((d) => d.LR);

      // Create adjusted LR values based on azimuth (approximately)
      let lrAdjusted = hddData.map((d) => {
        return d.LR * Math.cos((233.5 * Math.PI) / 180);
      });

      // State variables
      let showSurface = ${isSurfaceReady && surfaceData.length > 0};
      let showCenterline = true;
      let selectedJointIndex = -1;

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

      // Function to interpolate elevation at a specific station from surface data
      function interpolateElevation(station, surfacePoints) {
        if (!surfacePoints || surfacePoints.length === 0) return null;
        
        // Sort surface points by station
        const sortedPoints = [...surfacePoints].sort((a, b) => a.Station - b.Station);
        
        // If station is before the first surface point
        if (station <= sortedPoints[0].Station) {
          return sortedPoints[0].Elevation;
        }
        
        // If station is after the last surface point
        if (station >= sortedPoints[sortedPoints.length - 1].Station) {
          return sortedPoints[sortedPoints.length - 1].Elevation;
        }
        
        // Find the two surrounding points for interpolation
        let beforePoint = sortedPoints[0];
        let afterPoint = sortedPoints[1];
        
        for (let i = 1; i < sortedPoints.length; i++) {
          if (sortedPoints[i].Station >= station) {
            beforePoint = sortedPoints[i-1];
            afterPoint = sortedPoints[i];
            break;
          }
        }
        
        // Linear interpolation
        const ratio = (station - beforePoint.Station) / (afterPoint.Station - beforePoint.Station);
        return beforePoint.Elevation + ratio * (afterPoint.Elevation - beforePoint.Elevation);
      }

      // Function to calculate centerline points
      function calculateCenterline() {
        if (!entryPoint || !exitPoint) return null;
        
        const centerlinePoints = {
          x: [],
          y: [],
          z: []
        };

        // If we have surface data, use it to set centerline elevation
        if (surfaceData && surfaceData.length > 0) {
          // Limit surface data to HDD length
          const filteredSurfaceData = surfaceData.filter(
            point => point.Station >= entryPoint.Away && point.Station <= exitPoint.Away
          );
          
          // Create more points along the centerline for smoother surface following
          const stepSize = 10; // Every 10 feet
          for (let station = entryPoint.Away; station <= exitPoint.Away; station += stepSize) {
            const elevation = interpolateElevation(station, filteredSurfaceData);
            if (elevation !== null) {
              centerlinePoints.x.push(station);
              centerlinePoints.y.push(0); // Centerline is at 0 offset
              centerlinePoints.z.push(elevation);
            }
          }
          
          // Make sure to include the exact entry and exit points
          if (centerlinePoints.x[0] !== entryPoint.Away) {
            const entryElevation = interpolateElevation(entryPoint.Away, filteredSurfaceData);
            centerlinePoints.x.unshift(entryPoint.Away);
            centerlinePoints.y.unshift(0);
            centerlinePoints.z.unshift(entryElevation !== null ? entryElevation : entryPoint.Elev);
          }
          
          if (centerlinePoints.x[centerlinePoints.x.length-1] !== exitPoint.Away) {
            const exitElevation = interpolateElevation(exitPoint.Away, filteredSurfaceData);
            centerlinePoints.x.push(exitPoint.Away);
            centerlinePoints.y.push(0);
            centerlinePoints.z.push(exitElevation !== null ? exitElevation : exitPoint.Elev);
          }
        } else {
          // If no surface data, just use entry and exit points
          centerlinePoints.x = [entryPoint.Away, exitPoint.Away];
          centerlinePoints.y = [0, 0]; // Centerline is at 0 offset
          centerlinePoints.z = [entryPoint.Elev, exitPoint.Elev];
        }

        return centerlinePoints;
      }

      // Function to create centerline corridor (10ft wide, 5ft on each side)
      function createCenterlineCorridor() {
        if (!entryPoint || !exitPoint) return null;
        
        // Get centerline points that follow the surface
        const centerlinePoints = calculateCenterline();
        if (!centerlinePoints || centerlinePoints.x.length === 0) return null;
        
        // Instead of using mesh3d which creates unwanted vertical walls,
        // create a series of flat rectangular segments using scatter3d with fill3d
        const numPoints = centerlinePoints.x.length;
        
        // Create left and right side points for the corridor
        const leftX = [...centerlinePoints.x];
        const leftY = centerlinePoints.x.map(() => -5); // 5ft to the left
        const leftZ = [...centerlinePoints.z];
        
        const rightX = [...centerlinePoints.x];
        const rightY = centerlinePoints.x.map(() => 5); // 5ft to the right
        const rightZ = [...centerlinePoints.z];
        
        // Create a surface using multiple scatter3d traces
        const traces = [];
        
        // Main corridor surface (flat plane)
        traces.push({
          type: 'surface',
          x: [leftX, rightX],
          y: [leftY, rightY],
          z: [leftZ, rightZ],
          opacity: 0.3,
          showscale: false,
          colorscale: [[0, '#ff9900'], [1, '#ff9900']],
          hoverinfo: 'none'
        });
        
        return traces;
      }

      // Function to prepare surface data for visualization
      function prepareSurfaceData() {
        if (!surfaceData || surfaceData.length === 0) return null;
        
        // Only use surface data within the HDD range
        let filteredSurfaceData = surfaceData;
        
        if (entryPoint && exitPoint) {
          filteredSurfaceData = surfaceData.filter(
            point => point.Station >= entryPoint.Away && point.Station <= exitPoint.Away
          );
        }
        
        if (filteredSurfaceData.length === 0) return null;

        // Convert to 3D representation
        const surfaceX = filteredSurfaceData.map(point => point.Station);
        const surfaceY = filteredSurfaceData.map(point => point.Offset);
        const surfaceZ = filteredSurfaceData.map(point => point.Elevation);

        return {
          type: 'scatter3d',
          mode: 'markers',
          x: surfaceX,
          y: surfaceY,
          z: surfaceZ,
          marker: {
            size: 3,
            color: '#33cc33',
            symbol: 'circle'
          },
          name: 'Surface Data',
          hoverinfo: 'text',
          hovertext: filteredSurfaceData.map(
            (d) => 
              \`Station: \${d.Station.toFixed(2)}<br>\` +
              \`Elevation: \${d.Elevation.toFixed(2)}\`
          )
        };
      }

      // Function to calculate depth to surface for each joint
      function calculateDepthToSurface() {
        if (!surfaceData || surfaceData.length === 0) return Array(hddData.length).fill("N/A");

        // For each joint, interpolate surface elevation and calculate depth
        return hddData.map(joint => {
          const surfaceElevation = interpolateElevation(joint.Away, surfaceData);
          
          if (surfaceElevation === null) return "N/A";
          
          // Calculate depth (surface elevation minus joint elevation)
          const depth = surfaceElevation - joint.Elev;
          return depth.toFixed(2);
        });
      }

      // Create 3D plots using Plotly
      function createPlots() {
        console.log("HDD Data being plotted:", hddData);
        console.log("Away values:", away);
        console.log("Elevation values:", elev);
        console.log("LR values:", lr);
        
        // Calculate depthToSurface
        const depthToSurface = surfaceData.length > 0 ? calculateDepthToSurface() : Array(hddData.length).fill("N/A");
        
        // Update the joints table with depth information
        populateJointsTable(depthToSurface);

        // 3D Plot traces
        const traces3D = [];

        // 1. Bore Path
        const borePath = {
          type: "scatter3d",
          mode: "lines",
          name: "Bore Path",
          x: away,
          y: lrAdjusted,
          z: elev,
          line: {
            color: "#1f77b4",
            width: 6,
          },
          hoverinfo: "text",
          hovertext: hddData.map(
            (d, i) =>
              \`Joint: \${d.Joint}<br>\` +
              \`Away: \${d.Away.toFixed(2)} ft<br>\` +
              \`Elevation: \${d.Elev.toFixed(2)} ft<br>\` +
              \`Inclination: \${d.Inclination.toFixed(2)}°<br>\` +
              \`L/R: \${d.LR.toFixed(2)} ft<br>\` +
              \`Depth to Surface: \${depthToSurface[i]}\`
          ),
          customdata: hddData.map((d, i) => i)
        };
        traces3D.push(borePath);

        // 2. Add joints as separate non-clickable points
        const joints = {
          type: "scatter3d",
          mode: "markers",
          name: "Joints",
          x: away,
          y: lrAdjusted,
          z: elev,
          marker: {
            size: 5,
            color: "#1f77b4",
            symbol: "circle"
          },
          hoverinfo: "skip",
          showlegend: false
        };
        traces3D.push(joints);

        // 3. Add centerline if entry and exit points are available
        if (entryPoint && exitPoint) {
          const centerlinePoints = calculateCenterline();
          
          // Centerline line
          const centerline = {
            type: "scatter3d",
            mode: "lines",
            name: "Centerline",
            x: centerlinePoints.x,
            y: centerlinePoints.y,
            z: centerlinePoints.z,
            line: {
              color: "#ff9900",
              width: 5,
              dash: 'dash'
            },
            showlegend: true,
            visible: showCenterline ? true : "legendonly"
          };
          traces3D.push(centerline);
          
          // Add centerline corridor (10ft wide surface plane)
          const corridorTraces = createCenterlineCorridor();
          if (corridorTraces && corridorTraces.length > 0) {
            corridorTraces.forEach(trace => {
              trace.visible = showCenterline ? true : "legendonly";
              trace.name = "Centerline Corridor";
              traces3D.push(trace);
            });
          }
        }

        // 4. Add surface data if available and enabled
        const surfaceTrace = prepareSurfaceData();
        if (surfaceTrace) {
          surfaceTrace.visible = showSurface ? true : "legendonly";
          traces3D.push(surfaceTrace);
        }

        // 3D Plot layout
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
            (d, i) =>
              \`Joint: \${d.Joint}<br>\` +
              \`Away: \${d.Away.toFixed(2)} ft<br>\` +
              \`Elevation: \${d.Elev.toFixed(2)} ft<br>\` +
              \`Inclination: \${d.Inclination.toFixed(2)}°<br>\` +
              \`Depth to Surface: \${depthToSurface[i]}\`
          ),
          customdata: hddData.map((d, i) => i),
        };

        const traces2D = [profile];

        // Add surface profile to 2D plot if surface data exists
        if (surfaceData && surfaceData.length > 0) {
          // Filter surface data to HDD range
          let filteredSurfaceData = surfaceData;
          if (entryPoint && exitPoint) {
            filteredSurfaceData = surfaceData.filter(
              point => point.Station >= entryPoint.Away && point.Station <= exitPoint.Away
            );
          }
          
          // Sort by station
          const sortedSurfaceData = [...filteredSurfaceData].sort((a, b) => a.Station - b.Station);
          
          // Create surface profile trace
          const surfaceProfileTrace = {
            type: "scatter",
            mode: "lines",
            name: "Surface Profile",
            x: sortedSurfaceData.map(p => p.Station),
            y: sortedSurfaceData.map(p => p.Elevation),
            line: {
              color: "#33cc33",
              width: 2,
              dash: 'dot'
            },
            visible: showSurface ? true : "legendonly"
          };
          
          traces2D.push(surfaceProfileTrace);
          
          // Add centerline to 2D plot
          if (entryPoint && exitPoint) {
            const centerlinePoints = calculateCenterline();
            const centerlineProfile = {
              type: "scatter",
              mode: "lines",
              name: "Centerline Profile",
              x: centerlinePoints.x,
              y: centerlinePoints.z,
              line: {
                color: "#ff9900",
                width: 2,
                dash: 'dash'
              },
              visible: showCenterline ? true : "legendonly"
            };
            
            traces2D.push(centerlineProfile);
          }
        }

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

        // Create 3D plot 
        Plotly.newPlot(
          "plot3d",
          traces3D,
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

        // Create 2D plot
        Plotly.newPlot(
          "plot2d",
          traces2D,
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

      // Function to populate joints table
      function populateJointsTable(depthToSurface) {
        const tableBody = document.getElementById("jointsTableBody");
        tableBody.innerHTML = ""; // Clear existing rows
        
        hddData.forEach((joint, index) => {
          const row = document.createElement("tr");
          row.setAttribute("data-joint-index", index);
          
          // Add row data
          row.innerHTML = \`
            <td>\${joint.Joint}</td>
            <td>\${joint.Away.toFixed(2)}</td>
            <td>\${joint.Elev.toFixed(2)}</td>
            <td>\${joint.Length.toFixed(2)}</td>
            <td>\${joint.Inclination.toFixed(2)}</td>
            <td>\${joint.LR.toFixed(2)}</td>
            <td>\${joint.RawAzi.toFixed(2)}</td>
            <td>\${depthToSurface[index]}</td>
          \`;
          
          // Add click event to highlight row and joint in plots
          row.addEventListener("click", function() {
            selectJoint(index);
          });
          
          tableBody.appendChild(row);
        });
      }

      function selectJoint(jointIndex) {
        if (jointIndex < 0 || jointIndex >= hddData.length) return;
        
        // Update table - highlight selected row and remove highlight from others
        const tableRows = document.querySelectorAll("#jointsTableBody tr");
        tableRows.forEach(row => row.classList.remove("selected"));
        
        const selectedRow = document.querySelector(\`#jointsTableBody tr[data-joint-index="\${jointIndex}"]\`);
        if (selectedRow) selectedRow.classList.add("selected");
        
        // Scroll selected row into view
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Update the plot highlighting - 2D plot only
        highlightSelectedJoint(jointIndex);
        
        // Save selected joint index
        selectedJointIndex = jointIndex;
      }

      function highlightSelectedJoint(jointIndex) {
        try {
          // Get current data from plot2d
          const plot2d = document.getElementById("plot2d");

          // Clear any previous selection
          if (plot2d && plot2d.data.length > 1 && plot2d.data[plot2d.data.length - 1].name === "Selected Joint") {
            Plotly.deleteTraces("plot2d", plot2d.data.length - 1);
          }

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

          // Add the highlighted point to the plot
          Plotly.addTraces("plot2d", highlightedPoint2D);
          
          console.log("Joint highlighted in 2D:", jointIndex);
        } catch (error) {
          console.error("Error highlighting joint:", error);
        }
      }

      function setupEventListeners() {
        // Make only 2D plot clickable to select joints
        document.getElementById("plot2d").on("plotly_click", function (data) {
          if (!data || !data.points || data.points.length === 0) return;

          const point = data.points[0];
          if (!point.hasOwnProperty("customdata")) return;

          const jointIndex = point.customdata;
          selectJoint(jointIndex);
        });

        // Reset view button
        document.getElementById("resetViewBtn").addEventListener("click", function () {
          Plotly.relayout("plot3d", {
            "scene.camera.eye": { x: 3, y: -3, z: 1.25 },
            "scene.camera.center": { x: 0, y: 0, z: 0 },
          });
        });
          
        // Front view button
        document.getElementById("frontViewBtn").addEventListener("click", function () {
          Plotly.relayout("plot3d", {
            "scene.camera.eye": { x: 0, y: -2.5, z: 0.1 },
            "scene.camera.center": { x: 0, y: 0, z: 0 },
          });
        });
          
        // Top view button
        document.getElementById("topViewBtn").addEventListener("click", function () {
          Plotly.relayout("plot3d", {
            "scene.camera.eye": { x: 0.1, y: 0.1, z: 2.5 },
            "scene.camera.center": { x: 0, y: 0, z: 0 },
            "scene.camera.up": { x: 0, y: 1, z: 0 }
          });
        });

        // Toggle centerline visibility
        document.getElementById("toggleCenterlineBtn").addEventListener("click", function () {
          showCenterline = !showCenterline;
          
          // Update visibility for centerline traces (index 2, 3)
          const visibility = showCenterline ? true : "legendonly";
          if (document.getElementById("plot3d").data.length > 3) {
            Plotly.restyle("plot3d", { visible: visibility }, [2, 3]);
          }
          
          // Update centerline in 2D plot
          const plot2d = document.getElementById("plot2d");
          const centerlineIndex = plot2d.data.findIndex(trace => trace.name === "Centerline Profile");
          
          if (centerlineIndex !== -1) {
            Plotly.restyle("plot2d", { visible: visibility }, [centerlineIndex]);
          }
        });
          
                  // Surface is always shown - no toggle needed
          
        // Zoom in button
        document.getElementById("zoomInBtn").addEventListener("click", function () {
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
        document.getElementById("zoomOutBtn").addEventListener("click", function () {
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

      // Initialize the plots when the page loads
      window.addEventListener("load", function() {
        createPlots();
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

  const customSurfaceUploadProps = {
    name: "surfaceFile",
    accept: ".xlsx, .xls",
    showUploadList: false,
    beforeUpload: (file) => {
      setSurfaceFile(file);
      setSurfaceFileName(file.name);
      setSurfaceErrorMessage("");
      setIsSurfaceReady(false);
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
              <Step title="Upload" description="Data files" />
              <Step title="Process" description="Data analysis" />
              <Step title="Download" description="HTML visualization" />
            </Steps>

            {currentStep === 0 && (
              <div>
                <Title level={4}>Upload Bore & Surface Data</Title>
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

                {errorMessage && (
                  <Alert
                    message="Error"
                    description={errorMessage}
                    type="error"
                    showIcon
                    className="mt-4 mb-4"
                  />
                )}

                <Divider />

                <Title level={4}>Upload Surface Data (Optional)</Title>
                <Paragraph>
                  Optionally, select an Excel file with surface data. The file
                  should contain the following columns:
                </Paragraph>
                <ul className="list-disc pl-8 mb-4 text-gray-700">
                  <li>Station (or STA)</li>
                  <li>Elevation (or ELEV)</li>
                </ul>

                <Alert
                  message="Optional Data"
                  description="Surface data is optional. If provided, it will allow visualization of the bore path relative to the surface."
                  type="info"
                  showIcon
                  className="mb-4"
                />

                <Dragger {...customSurfaceUploadProps} className="mb-6">
                  <p className="ant-upload-drag-icon">
                    <FileExcelOutlined
                      style={{ fontSize: "32px", color: "#1890ff" }}
                    />
                  </p>
                  <p className="ant-upload-text">
                    Click or drag surface Excel file to this area to upload
                  </p>
                  <p className="ant-upload-hint">
                    Support for single Excel file upload (.xlsx, .xls)
                  </p>
                </Dragger>

                {surfaceFileName && (
                  <Alert
                    message={`Selected surface file: ${surfaceFileName}`}
                    type="info"
                    showIcon
                    className="mb-4"
                  />
                )}

                {surfaceErrorMessage && (
                  <Alert
                    message="Error"
                    description={surfaceErrorMessage}
                    type="error"
                    showIcon
                    className="mt-4"
                  />
                )}

                {surfaceSuccessMessage && (
                  <Alert
                    message="Surface Data Processed Successfully"
                    description={surfaceSuccessMessage}
                    type="success"
                    showIcon
                    className="mt-4"
                    icon={<CheckCircleOutlined />}
                  />
                )}

                {/* New "Process Surface Data" button */}
                <Button
                  type="primary"
                  onClick={processSurfaceExcelFile}
                  disabled={!surfaceFile || isSurfaceProcessing}
                  icon={
                    isSurfaceProcessing ? <Spin indicator={antIcon} /> : null
                  }
                  size="large"
                  block
                  style={{ marginTop: "20px", marginBottom: "10px" }}
                >
                  {isSurfaceProcessing
                    ? "Processing Surface Data..."
                    : "Process Surface Data"}
                </Button>

                <Button
                  type="primary"
                  onClick={processExcelFile}
                  disabled={!file || isProcessing}
                  icon={isProcessing ? <Spin indicator={antIcon} /> : null}
                  size="large"
                  block
                  style={{ marginTop: "20px" }}
                >
                  {isProcessing ? "Processing..." : "Process Data"}
                </Button>
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
                  <Collapse defaultActiveKey={["1"]}>
                    <Panel header="Bore Path Data" key="1">
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
                            {Math.min(...hddData.map((d) => d.Elev)).toFixed(2)}{" "}
                            ft to{" "}
                            {Math.max(...hddData.map((d) => d.Elev)).toFixed(2)}{" "}
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
                    </Panel>

                    {isSurfaceReady && (
                      <Panel header="Surface Data" key="2">
                        <Space direction="vertical" className="w-full">
                          <Text>
                            Total Surface Points:{" "}
                            <Text strong>{surfaceData.length}</Text>
                          </Text>
                          <Text>
                            Station Range:{" "}
                            <Text strong>
                              {Math.min(
                                ...surfaceData.map((d) => d.Station)
                              ).toFixed(2)}{" "}
                              ft to{" "}
                              {Math.max(
                                ...surfaceData.map((d) => d.Station)
                              ).toFixed(2)}{" "}
                              ft
                            </Text>
                          </Text>
                          <Text>
                            Elevation Range:{" "}
                            <Text strong>
                              {Math.min(
                                ...surfaceData.map((d) => d.Elevation)
                              ).toFixed(2)}{" "}
                              ft to{" "}
                              {Math.max(
                                ...surfaceData.map((d) => d.Elevation)
                              ).toFixed(2)}{" "}
                              ft
                            </Text>
                          </Text>
                          <Text>
                            Surface data will be visualized with the bore path.
                          </Text>
                        </Space>
                      </Panel>
                    )}

                    <Panel header="Visualization Features" key="3">
                      <ul className="list-disc pl-8 mb-4 text-gray-700">
                        <li>Interactive 3D bore path visualization</li>
                        <li>2D profile view of the bore path</li>
                        <li>Complete joint data table with scrolling</li>
                        <li>
                          Centerline corridor (10ft wide - 5ft on each side)
                        </li>
                        {isSurfaceReady && (
                          <>
                            <li>Surface data visualization</li>
                            <li>
                              Calculation of pipe depth relative to surface
                            </li>
                            <li>Centerline that follows surface elevation</li>
                          </>
                        )}
                      </ul>
                    </Panel>
                  </Collapse>
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

                <div className="mt-4">
                  <Text type="secondary">
                    <QuestionCircleOutlined /> The visualization will open in
                    any modern web browser and doesn't require an internet
                    connection.
                  </Text>
                </div>
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

                <Title level={5}>How to Use the Visualization:</Title>
                <ul className="list-disc pl-8 mb-4 text-gray-700">
                  <li>
                    Click on joints in the 2D profile or table to highlight them
                  </li>
                  <li>Use the zoom buttons or mouse wheel to zoom in/out</li>
                  <li>
                    Toggle the visibility of surface data and centerline with
                    the buttons
                  </li>
                  <li>
                    View bore path depth relative to surface in the data table
                  </li>
                  <li>
                    Use the front and top view buttons for predefined
                    perspectives
                  </li>
                </ul>

                <Divider />

                <Space className="w-full">
                  <Button
                    onClick={() => {
                      setFile(null);
                      setFileName("");
                      setSurfaceFile(null);
                      setSurfaceFileName("");
                      setIsReady(false);
                      setIsSurfaceReady(false);
                      setErrorMessage("");
                      setSurfaceErrorMessage("");
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
          Upload Data → Process → Download HTML
        </Text>
      </Footer>

      <Modal
        title="Name Your Visualization File"
        open={isNameModalVisible}
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
