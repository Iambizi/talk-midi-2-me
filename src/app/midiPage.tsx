"use client";

import React, { useState, useEffect } from "react";
import styles from "./styling/midiPage.module.scss";
import io, { Socket } from "socket.io-client";

// Define the file status interface
interface FileStatus {
    name: string;
    status: string;
    details?: MidiDetails;
    error?: string;
}

interface MidiDetails {
    midiData: {
        tempos: number[];
        keySignatures: Array<{ key: number; scale: string }>;
        instruments: Array<{ channel: number; instrument: number; deltaTime: number }>;
        structure: Array<{ noteNumber: number; velocity: number; deltaTime: number; type: string }>;
        sections: Array<{ type: string; events: any[] }>;
    };
}

// Define the interface for socket error
interface SocketError {
    message?: string;
    description?: string;
    context?: any;
}

export default function MidiInput() {
    const [filesStatus, setFilesStatus] = useState<FileStatus[]>([]); // To store and display file upload status
    const socket: Socket = io("http://localhost:3000", { path: "/api/socket_io" });

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
    socket.on("file-processed", (data: { file: string; data: MidiDetails }) => {
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
                        {file.details && (
                            <div>
                                <h3>Tempo</h3>
                                <ul>
                                    {file.details.midiData.tempos.map((tempo, i) => (
                                        <li key={i}>{tempo} BPM</li>
                                    ))}
                                </ul>
                                <h3>Key Signatures</h3>
                                <ul>
                                    {file.details.midiData.keySignatures.map((key, i) => (
                                        <li key={i}>{key.key} {key.scale}</li>
                                    ))}
                                </ul>
                                <h3>Instruments</h3>
                                <ul>
                                    {file.details.midiData.instruments.map((instr, i) => (
                                        <li key={i}>
                                            Channel: {instr.channel}, Instrument: {instr.instrument}, Delta Time: {instr.deltaTime}
                                        </li>
                                    ))}
                                </ul>
                                <h3>Structure</h3>
                                <ul>
                                    {file.details.midiData.structure.map((note, i) => (
                                        <li key={i}>
                                            Note: {note.noteNumber}, Type: {note.type}, Velocity: {note.velocity}, Delta Time: {note.deltaTime}
                                        </li>
                                    ))}
                                </ul>
                                <h3>Sections</h3>
                                <ul>
                                    {file.details.midiData.sections.map((section, i) => (
                                        <li key={i}>
                                            Type: {section.type}, Events: {section.events.length}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
