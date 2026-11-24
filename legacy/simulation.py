"""
MIT License

Copyright (c) 2025 Walter Mendez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import numpy as np
import pandas as pd

def monte_carlo_outcomes(trials=10000, mean=0.05, std=0.15, periods=12):
    """
    Simple Monte Carlo for compounded growth over periods.
    Returns a DataFrame with path outcomes and summary stats.
    """
    rng = np.random.default_rng()
    shocks = rng.normal(loc=mean/periods, scale=std/np.sqrt(periods), size=(trials, periods))
    paths = (1 + shocks).cumprod(axis=1)
    final = paths[:, -1]
    df = pd.DataFrame({
        "final_multiplier": final
    })
    return df

if __name__ == "__main__":
    df = monte_carlo_outcomes()
    print(df.describe(percentiles=[0.1, 0.5, 0.9]).to_string())
