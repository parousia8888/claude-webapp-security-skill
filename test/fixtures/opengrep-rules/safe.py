import subprocess


def run_report():
    subprocess.run(["/usr/bin/report", "--format", "json"], check=True)
