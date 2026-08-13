import subprocess
from flask import request


def run_report():
    command = request.args.get("command")
    subprocess.run(command, shell=True, check=True)
