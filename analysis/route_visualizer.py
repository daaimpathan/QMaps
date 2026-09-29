"""Route visualization for QMaps results.

Generates 2D plots showing vehicle routes, customers, and depot.
"""

import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from vrp_loader import load_instance
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def plot_routes(instance, routes, title="", output_path=None):
    """Plot vehicle routes on a 2D coordinate plane.

    Args:
        instance: VRPInstance with coordinates
        routes: List of routes (each route = list of customer IDs)
        title: Plot title
        output_path: Where to save the image
    """
    fig, ax = plt.subplots(figsize=(12, 10))

    colors = plt.cm.Set3(np.linspace(0, 1, len(routes)))

    # Plot depot
    depot_coords = instance.coords[0]
    ax.scatter(
        depot_coords[0],
        depot_coords[1],
        s=300,
        marker='s',
        color='black',
        edgecolor='black',
        linewidth=2,
        label='Depot',
        zorder=5,
    )

    # Plot customers
    for customer in instance.customer_ids:
        coord = instance.coords[customer]
        ax.scatter(
            coord[0],
            coord[1],
            s=150,
            marker='o',
            color='gray',
            edgecolor='black',
            alpha=0.6,
            zorder=4,
        )
        ax.text(
            coord[0] + 0.5,
            coord[1] + 0.5,
            str(customer),
            fontsize=9,
            ha='center',
            va='center',
            fontweight='bold',
        )

    # Plot routes
    for route_idx, route in enumerate(routes):
        if not route:
            continue

        route_coords = []
        route_coords.append(depot_coords)  # Start at depot
        for customer in route:
            route_coords.append(instance.coords[customer])
        route_coords.append(depot_coords)  # Return to depot

        route_coords = np.array(route_coords)

        # Draw route lines
        ax.plot(
            route_coords[:, 0],
            route_coords[:, 1],
            marker='o',
            markersize=8,
            color=colors[route_idx],
            linewidth=2.5,
            label=f"Vehicle {route_idx + 1} ({len(route)} customers)",
            zorder=3,
        )

        # Annotate route direction with arrows
        for i in range(len(route_coords) - 1):
            ax.annotate(
                "",
                xy=(route_coords[i + 1, 0], route_coords[i + 1, 1]),
                xytext=(route_coords[i, 0], route_coords[i, 1]),
                arrowprops=dict(
                    arrowstyle="->",
                    color=colors[route_idx],
                    alpha=0.7,
                    linewidth=1.5,
                ),
            )

    ax.set_title(title, fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel("X Coordinate", fontsize=12)
    ax.set_ylabel("Y Coordinate", fontsize=12)
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper left', bbox_to_anchor=(1.05, 1), fontsize=10)
    ax.set_aspect('equal', adjustable='box')

    # Add statistics in a box
    stats_text = f"""
Total Routes: {len(routes)}
Total Customers: {sum(len(r) for r in routes)}
Avg. Customers per Route: {sum(len(r) for r in routes) / len(routes):.1f}
"""
    ax.text(
        1.02, 0.3, stats_text,
        transform=ax.transAxes,
        fontsize=10,
        verticalalignment='top',
        bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3),
    )

    plt.tight_layout()

    if output_path:
        plt.savefig(output_path, dpi=200, bbox_inches='tight')
        print(f"Saved route visualization to: {output_path}")
    else:
        plt.show()


def visualize_best_solution():
    """Quick demo: load RC101 and visualize a sample solution."""
    inst_path = ROOT / "data" / "instances" / "RC101.csv"
    instance = load_instance(str(inst_path), n_customers=25)

    # Sample solution (you would load real results)
    # Here's a sample route structure:
    routes = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25],
    ]

    output_path = ROOT / "results" / "route_visualization.png"
    output_path.parent.mkdir(exist_ok=True)

    plot_routes(
        instance,
        routes,
        title="Route Visualization - RC101 (Sample)",
        output_path=output_path,
    )


def main():
    """Run route visualization for specified algorithm results."""
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python route_visualizer.py <result_json>")
        print("       python route_visualizer.py --demo")
        sys.exit(1)

    if sys.argv[1] == "--demo":
        visualize_best_solution()
        return

    # Load algorithm results
    result_json = Path(sys.argv[1])
    output_dir = result_json.parent

    with open(result_json, 'r') as f:
        result = json.load(f)

    # Extract instance info and routes
    instance_path = ROOT / "data" / "instances" / f"{result.get('instance', 'RC101')}.csv"
    n_customers = result.get('n_customers', 25)

    instance = load_instance(str(instance_path), n_customers=n_customers)
    routes = result.get('routes', [])

    if not routes:
        print("No routes found in result file.")
        return

    # Generate plot
    output_path = output_dir / f"routes_{result.get('instance', 'RC101')}_{result.get('algorithm', 'unknown')}.png"
    plot_routes(
        instance,
        routes,
        title=f"{result.get('algorithm', 'Algorithm')} - {result.get('instance', 'RC101')}",
        output_path=output_path,
    )


if __name__ == "__main__":
    main()
