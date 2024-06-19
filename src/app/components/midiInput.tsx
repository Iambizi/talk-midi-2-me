"use client";

import React, { useState, useEffect } from "react";
import styles from "./styling/midiPage.module.scss";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
    path: "/api/socket_io/"  
});

interface FileStatus {
    name: string;
    status: string;
    details?: MidiDetails;
    error?: string;
}

interface MidiDetails {
    tempos: number[];
    keySignatures: Array<{ key: number; scale: string }>;
    instruments: Array<{ channel: number; instrument: number; deltaTime: number }>;
    structure: Array<{ noteNumber: number; velocity: number; deltaTime: number; type: string }>;
    sections: Array<{ type: string; events: any[] }>;
}

export default function MidiInput() {
    const [filesStatus, setFilesOfStatus] = useState<FileStatus[]>([]);

    useEffect(() => {
        socket.on("connect", () => {
            console.log("Connected to the server");
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from the server");
        });

        socket.on("file-processed", (data: { file: string; data: MidiDetails }) => {
            console.log("Processing complete:", data);
            setFilesOfStatus(prevStatus =>
                prevStatus.map(file =>
                    file.name === data.file ? { ...file, status: "Processed", details: data.data } : file
                )
            );
        });

        socket.on("file-error", (data: { file: string; error: string }) => {
            console.log("Error processing file:", data);
            setFilesOfStatus(prevStatus =>
                prevStatus.map(file =>
                    file.name === data.file ? { ...file, status: "Error", error: data.error } : file
                )
            );
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("file-processed");
            socket.off("file-error");
        };
    }, []);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const formData = new FormData();
        let initialFilesStatus: FileStatus[] = [];
        Array.from(files).forEach(file => {
            formData.append("midiFiles", file);
            initialFilesStatus.push({ name: file.name, status: "Uploading" });
        });

        setFilesOfStatus(initialFilesStatus);

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
            setFilesOfStatus(prevStatus =>
                prevStatus.map(file => ({
                    ...file,
                    status: "Uploaded, waiting for processing"
                }))
            );
        } catch (error) {
            console.error("An error occurred while uploading the files:", error);
            setFilesOfStatus(prevStatus =>
                prevStatus.map(file => ({
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
                                <h3>Details:</h3>
                                <p>Tempo changes: {file.details.tempos.map(tempo => `${tempo} BPM`).join(', ')}</p>
                                <p>Key signatures: {file.details.keySignatures.map(ks => `${ks.key} ${ks.scale}`).join(', ')}</p>
                                {/* Other details like instruments, structure, and sections can also be displayed similarly */}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
