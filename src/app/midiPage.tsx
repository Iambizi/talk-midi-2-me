"use client";

import React, { useState, useEffect } from "react";
import styles from "./styling/midiPage.module.scss";
import io, { Socket } from "socket.io-client";

// Define the file status interface
interface FileStatus {
    name: string;
    status: string;
    details?: any;
    error?: string;
}

// Define the interface for socket error
interface SocketError {
    message?: string;
    description?: string;
    context?: any;
}

export default function MidiInput() {
    const [filesStatus, setFilesStatus] = useState<FileStatus[]>([]); // To store and display file upload status
    const socket: Socket = io('http://localhost:3000', { path: '/api/socket_io' });
    // const socket: Socket = io('http://localhost:3000/api/socket_io');

    // Log connection errors
    socket.on("connect_error", (err: SocketError) => {
        console.log('Connection Error:', err);
        if (err.message) {
            console.log('Error Message:', err.message);
        }
        if (err.description) {
            console.log('Error Description:', err.description);
        }
        if (err.context) {
            console.log('Error Context:', err.context);
        }
    });

    // Connection events
    socket.on("connect", () => {
        console.log("Connected to the server");
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from the server");
    });

    // Listen to file processing status from the server
    socket.on("file-processed", (data: { file: string; data: any }) => {
        console.log("Processing complete:", data);
        // Update the status of the processed file
        setFilesStatus((prevStatus) =>
            prevStatus.map((file) =>
                file.name === data.file ? { ...file, status: "Processed", details: data.data } : file
            )
        );
    });

    socket.on("file-error", (data: { file: string; error: string }) => {
        console.log("Error processing file:", data);
        // Update the status with an error
        setFilesStatus((prevStatus) =>
            prevStatus.map((file) =>
                file.name === data.file ? { ...file, status: "Error", error: data.error } : file
            )
        );
    });

    // Handle file upload
    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        
        const formData = new FormData();
        let initialFilesStatus: FileStatus[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            formData.append("midiFiles", file);
            initialFilesStatus.push({ name: file.name, status: "Uploading" });
        }

        setFilesStatus(initialFilesStatus); // Set initial status for each file

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(data);
            // Update status to "Uploaded, waiting for processing"
            setFilesStatus((prevStatus) =>
                prevStatus.map((file) => ({
                    ...file,
                    status: "Uploaded, waiting for processing",
                }))
            );
        } catch (error) {
            console.error("An error occurred while uploading the files:", error);
            setFilesStatus((prevStatus) =>
                prevStatus.map((file) => ({
                    ...file,
                    status: "Upload failed",
                }))
            );
        }
    };

    return (
        <div className={styles.midiContainer}>
            <h1 className={styles.title}>Upload MIDI File</h1>
            <input
                type="file"
                webkitdirectory="true"
                directory="true"
                onChange={handleUpload}
                multiple
                accept=".mid,.midi"
                className={styles.fileInput}
            />
            <ul className={styles.fileList}>
                {filesStatus.map((file, index) => (
                    <li key={index}>
                        {file.name} - {file.status}
                    </li>
                ))}
            </ul>
        </div>
    );
}
