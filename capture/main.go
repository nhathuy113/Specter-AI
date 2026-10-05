package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"time"
)

var pngSignature = []byte{137, 80, 78, 71, 13, 10, 26, 10}

func screencaptureArgs(display int, outPath string) []string {
	if display == 0 {
		display = 1 // Capture only primary, avoiding extra output files on multi-monitor setups.
	}
	return []string{"-x", "-D", strconv.Itoa(display), outPath}
}

func capturePNGWithRunner(ctx context.Context, display int, run func(context.Context, []string) error) ([]byte, error) {
	if display < 0 {
		return nil, fmt.Errorf("display must be non-negative")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp("", "specter-cap-*.png")
	if err != nil {
		return nil, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Close(); err != nil {
		return nil, err
	}
	if err := run(ctx, screencaptureArgs(display, tmpPath)); err != nil {
		return nil, fmt.Errorf("screencapture: %w", err)
	}
	stat, err := os.Stat(tmpPath)
	if err != nil {
		return nil, err
	}
	if stat.Size() > 64*1024*1024 {
		return nil, fmt.Errorf("capture exceeds 64MB")
	}
	png, err := os.ReadFile(tmpPath)
	if err != nil {
		return nil, err
	}
	if !bytes.HasPrefix(png, pngSignature) {
		return nil, fmt.Errorf("capture did not produce a PNG")
	}
	return png, nil
}

func capturePNG(display int) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return capturePNGWithRunner(ctx, display, func(ctx context.Context, args []string) error {
		cmd := exec.CommandContext(ctx, "/usr/sbin/screencapture", args...)
		cmd.Stdout = io.Discard
		cmd.Stderr = os.Stderr
		return cmd.Run()
	})
}

func main() {
	display := flag.Int("display", 0, "1-based display index; 0 captures the primary display")
	flag.Parse()
	png, err := capturePNG(*display)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(png); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
